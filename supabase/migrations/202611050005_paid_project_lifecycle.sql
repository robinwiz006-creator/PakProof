-- Forward-only lifecycle. No historical terms, receipts or claims are rewritten.
begin;
alter table public.paid_projects drop constraint paid_projects_status_check;
alter table public.paid_projects add constraint paid_projects_status_check
 check(status in ('draft','published','offered','active','completed','withdrawn','cancelled'));
create table public.paid_project_events (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.paid_projects(id),
 actor_id uuid not null references public.profiles(id), action text not null,
 reason text not null check(char_length(reason) between 10 and 2000),
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.paid_project_events enable row level security;
create policy paid_events_parties on public.paid_project_events for select to authenticated
 using(public.paid_project_party(project_id) and (action<>'draft_edited' or exists(select 1 from public.paid_projects p where p.id=project_id and public.is_company_member(p.company_id))));
revoke all on public.paid_project_events from public,anon,authenticated,service_role;
grant select on public.paid_project_events to authenticated,service_role;
create trigger paid_events_immutable before update or delete on public.paid_project_events
 for each row execute function public.freeze_approved_record();
-- A request does not suspend the existing agreement. Both sides must agree at
-- confirmation time, after checking work and payments again under locks.
create table public.paid_cancellation_requests (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.paid_projects(id),
 requester_id uuid not null references public.profiles(id),requester_side text not null check(requester_side in ('company','worker')),
 reason text not null check(char_length(reason) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','accepted','declined','retracted')),
 created_at timestamptz not null default now(),responded_at timestamptz
);
create unique index one_pending_paid_cancellation on public.paid_cancellation_requests(project_id) where status='pending';
alter table public.paid_cancellation_requests enable row level security;
create policy paid_cancellation_parties on public.paid_cancellation_requests for select to authenticated
 using(public.paid_project_party(project_id));
revoke all on public.paid_cancellation_requests from public,anon,authenticated,service_role;
grant select on public.paid_cancellation_requests to authenticated,service_role;

create or replace function public.protect_paid_project_terms() returns trigger language plpgsql set search_path='' as $$begin
 if new.company_id<>old.company_id or
 (row(new.title,new.description,new.requirements,new.skills,new.deadline,new.budget_units) is distinct from
 row(old.title,old.description,old.requirements,old.skills,old.deadline,old.budget_units) and
 (old.status<>'draft' or new.status<>'draft' or exists(select 1 from public.paid_project_offers where project_id=old.id)))
 then raise exception 'Only an unpublished draft without offers may be corrected';end if;
 if (old.status in ('active','completed','cancelled') or exists(select 1 from public.paid_project_offers where id=old.current_offer_id and response='accepted'))
 and row(new.worker_id,new.current_offer_id) is distinct from row(old.worker_id,old.current_offer_id)
 then raise exception 'Accepted worker and terms are fixed';end if;
 return new;end;$$;
create or replace function public.protect_paid_milestone_terms() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.project_id,new.position) is distinct from row(old.project_id,old.position) or
 (row(new.title,new.deliverables,new.deadline,new.amount_units) is distinct from row(old.title,old.deliverables,old.deadline,old.amount_units)
 and not exists(select 1 from public.paid_projects p where p.id=old.project_id and p.status='draft'
 and not exists(select 1 from public.paid_project_offers o where o.project_id=p.id)
 and old.current_submission_id is null and old.work_status='not_submitted')) then raise exception 'Milestone terms are locked';end if;
 if old.work_status='approved' and row(new.work_status,new.current_submission_id,new.approval_id) is distinct from row(old.work_status,old.current_submission_id,old.approval_id) then raise exception 'Approved work cannot be rewritten';end if;
 return new;end;$$;

create function public.edit_paid_project(p_project uuid,p_title text,p_description text,p_requirements text,p_skills text[],p_deadline date,p_budget text,p_milestones jsonb,p_expected jsonb)
 returns void language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;m public.paid_milestones;j jsonb;v_total numeric:=0;v_before jsonb;begin
 perform id from public.paid_milestones where project_id=p_project order by position for update;
 select * into p from public.paid_projects where id=p_project for update;
 if p.id is null or not public.is_company_member(p.company_id) or p.status<>'draft' or p.worker_id is not null
 or exists(select 1 from public.paid_project_offers where project_id=p.id)
 or exists(select 1 from public.paid_project_applications where project_id=p.id)
 then raise exception 'Only untouched drafts can be edited';end if;
 v_before=jsonb_build_object('title',p.title,'description',p.description,'requirements',p.requirements,'skills',p.skills,'deadline',p.deadline,'budget_units',p.budget_units::text,'milestones',(select jsonb_agg(to_jsonb(x) order by position) from public.paid_milestones x where project_id=p.id));
 if v_before is distinct from p_expected then raise exception 'Draft changed. Reload before saving';end if;
 if p_deadline<current_date or p_budget!~'^[0-9]+$' or cardinality(p_skills)>20 or jsonb_typeof(p_milestones)<>'array'
 or jsonb_array_length(p_milestones)<>(select count(*) from public.paid_milestones where project_id=p.id)
 then raise exception 'Check draft deadlines, budget and milestone count';end if;
 for m in select * from public.paid_milestones where project_id=p.id order by position for update loop
 j=p_milestones->(m.position-1);
 if (j->>'deadline')::date<current_date or (j->>'deadline')::date>p_deadline or j->>'amount_units'!~'^[0-9]+$' then raise exception 'Check milestone dates and amounts';end if;
 update public.paid_milestones set title=j->>'title',deliverables=j->>'deliverables',deadline=(j->>'deadline')::date,amount_units=(j->>'amount_units')::numeric where id=m.id;
 v_total=v_total+(j->>'amount_units')::numeric;
 end loop;
 if v_total<>p_budget::numeric then raise exception 'Milestones must equal budget';end if;
 update public.paid_projects set title=p_title,description=p_description,requirements=p_requirements,skills=p_skills,deadline=p_deadline,budget_units=p_budget::numeric where id=p.id;
 insert into public.paid_project_events(project_id,actor_id,action,reason,details) values(p.id,auth.uid(),'draft_edited','Draft terms corrected before publication.',jsonb_build_object('before',v_before,'after',jsonb_build_object('title',p_title,'description',p_description,'requirements',p_requirements,'skills',p_skills,'deadline',p_deadline,'budget_units',p_budget,'milestones',p_milestones)));
 end;$$;

create function public.change_paid_lifecycle(p_project uuid,p_action text,p_reason text) returns void
 language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;r public.paid_cancellation_requests;v_side text;begin
 -- Match submission/payment lock order: milestone(s), then project. Never take
 -- a project lock and then wait for a concurrently preparing milestone.
 perform id from public.paid_milestones where project_id=p_project order by position for update;
 select * into p from public.paid_projects where id=p_project for update;
 v_side=case when public.is_company_owner(p.company_id) and p.worker_id is distinct from auth.uid() then 'company' when p.worker_id=auth.uid() and not public.is_company_member(p.company_id) then 'worker' end;
 if auth.uid() is null or p.id is null or v_side is null or char_length(trim(p_reason)) not between 10 and 2000 then raise exception 'Project party and a clear reason are required';end if;
 if p_action in ('withdraw','cancel') then
 if v_side<>'company' or p.status not in ('draft','published','offered') or (p_action='withdraw' and p.status='draft') then raise exception 'Only an owner can close an unaccepted opportunity';end if;
 if exists(select 1 from public.paid_project_offers where project_id=p.id and response='accepted') or exists(select 1 from public.payment_intents i join public.paid_milestones m on m.id=i.milestone_id where m.project_id=p.id) then raise exception 'Accepted work requires mutual cancellation';end if;
 update public.paid_projects set status=case when p_action='withdraw' then 'withdrawn' else 'cancelled' end where id=p.id;
 elsif p_action='request' then
 if p.status<>'active' then raise exception 'Only active agreements can request cancellation';end if;
 insert into public.paid_cancellation_requests(project_id,requester_id,requester_side,reason) values(p.id,auth.uid(),v_side,trim(p_reason)) returning * into r;
 elsif p_action in ('accept','decline','retract') then
 select * into r from public.paid_cancellation_requests where project_id=p.id and status='pending' for update;
 if r.id is null or p.status<>'active' or (p_action='retract' and r.requester_id<>auth.uid()) or (p_action<>'retract' and r.requester_side=v_side) then raise exception 'The opposite party must respond to this cancellation';end if;
 if p_action='accept' then
 if exists(select 1 from public.paid_milestones m where m.project_id=p.id and (m.work_status='submitted' or (m.work_status='approved' and not exists(select 1 from public.payment_receipts x where x.milestone_id=m.id))))
 or exists(select 1 from public.payment_intents i join public.paid_milestones m on m.id=i.milestone_id where m.project_id=p.id and i.status not in ('paid','failed','cancelled'))
 then raise exception 'Review submitted work, settle approved work and resolve all pending payments before cancellation';end if;
 update public.paid_projects set status='cancelled' where id=p.id;
 end if;
 update public.paid_cancellation_requests set status=case p_action when 'accept' then 'accepted' when 'decline' then 'declined' else 'retracted' end,responded_at=now() where id=r.id;
 else raise exception 'Unsupported lifecycle action';end if;
 insert into public.paid_project_events(project_id,actor_id,action,reason,details) values(p.id,auth.uid(),p_action,trim(p_reason),jsonb_build_object('previous_status',p.status,'request_id',r.id));
 end;$$;
revoke all on function public.edit_paid_project(uuid,text,text,text,text[],date,text,jsonb,jsonb),public.change_paid_lifecycle(uuid,text,text) from public,anon,service_role;
grant execute on function public.edit_paid_project(uuid,text,text,text,text[],date,text,jsonb,jsonb),public.change_paid_lifecycle(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
