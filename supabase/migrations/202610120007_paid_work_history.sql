begin;
-- Public work records deliberately contain no amounts, wallets, receipts or private contract terms.
create table public.paid_work_history (
 project_id uuid primary key references public.paid_projects(id),worker_id uuid not null references public.profiles(id),
 title text not null,company_name text not null,work_description text not null,skills text[] not null,deliverables jsonb not null,
 completed_at timestamptz not null,company_consent boolean not null default false,is_public boolean not null default false,share_evidence boolean not null default false,
 recipient_summary text not null default '' check(length(recipient_summary)<=4000)
);
create table public.paid_work_evidence (
 project_id uuid primary key references public.paid_work_history(project_id),evidence jsonb not null
);
alter table public.paid_work_history enable row level security;
alter table public.paid_work_evidence enable row level security;
create policy paid_history_read on public.paid_work_history for select using(public.paid_project_party(project_id) or (company_consent and is_public and public.public_talent(worker_id)));
create policy paid_history_evidence_read on public.paid_work_evidence for select using(public.paid_project_party(project_id) or exists(select 1 from public.paid_work_history h where h.project_id=paid_work_evidence.project_id and h.company_consent and h.is_public and h.share_evidence and public.public_talent(h.worker_id)));
create function public.initialize_paid_work_history(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;o public.paid_project_offers;begin
 select * into p from public.paid_projects where id=p_project;
 if p.id is null or p.status<>'completed' then raise exception 'Only completed, fully settled projects can become paid work history';end if;
 select * into o from public.paid_project_offers where id=p.current_offer_id;
 insert into public.paid_work_history(project_id,worker_id,title,company_name,work_description,skills,deliverables,completed_at)
 values(p.id,p.worker_id,p.title,o.terms->>'company_name',p.description,p.skills,(select jsonb_agg(jsonb_build_object('title',m.title,'deliverables',m.deliverables) order by m.position) from public.paid_milestones m where m.project_id=p.id),(select max(r.finalized_at) from public.payment_receipts r join public.paid_milestones m on m.id=r.milestone_id where m.project_id=p.id)) on conflict(project_id) do nothing;
 insert into public.paid_work_evidence(project_id,evidence) values(p.id,(select jsonb_agg(jsonb_build_object('title',m.title,'explanation',s.explanation,'evidence_url',s.evidence_url) order by m.position) from public.paid_milestones m join public.paid_milestone_submissions s on s.id=m.current_submission_id where m.project_id=p.id)) on conflict(project_id) do nothing;
 end;$$;
create function public.share_paid_work(p_project uuid,p_public boolean,p_evidence boolean,p_summary text) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.paid_projects where id=p_project and worker_id=auth.uid() and status='completed') then raise exception 'Only the completed-project worker may publish work history';end if;
 perform public.initialize_paid_work_history(p_project);
 update public.paid_work_history set is_public=p_public,share_evidence=p_evidence,recipient_summary=p_summary where project_id=p_project;end;$$;
create function public.consent_paid_work(p_project uuid,p_consent boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.paid_projects where id=p_project and public.is_company_member(company_id) and status='completed') then raise exception 'Only the owning company may consent to work disclosure';end if;
 perform public.initialize_paid_work_history(p_project);
 update public.paid_work_history set company_consent=p_consent where project_id=p_project;end;$$;
create function public.protect_paid_history() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-array['company_consent','is_public','share_evidence','recipient_summary']) is distinct from (to_jsonb(old)-array['company_consent','is_public','share_evidence','recipient_summary']) then raise exception 'Completed work facts cannot be rewritten';end if;return new;end;$$;
create trigger paid_history_immutable before update on public.paid_work_history for each row execute function public.protect_paid_history();
create trigger paid_history_evidence_immutable before update or delete on public.paid_work_evidence for each row execute function public.freeze_approved_record();
revoke all on public.paid_work_history,public.paid_work_evidence from anon,authenticated;
grant select on public.paid_work_history,public.paid_work_evidence to anon,authenticated,service_role;
revoke all on function public.initialize_paid_work_history(uuid) from public,anon,authenticated;
revoke all on function public.share_paid_work(uuid,boolean,boolean,text),public.consent_paid_work(uuid,boolean) from public,anon;
grant execute on function public.share_paid_work(uuid,boolean,boolean,text),public.consent_paid_work(uuid,boolean) to authenticated;
commit;
