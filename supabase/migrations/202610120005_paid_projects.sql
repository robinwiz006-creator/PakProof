-- Additive paid work foundation. No hosted migration is executed by the application.
begin;
create table public.paid_projects (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 title text not null check(length(trim(title)) between 3 and 160),description text not null check(length(trim(description)) between 30 and 5000),
 requirements text not null check(length(trim(requirements)) between 20 and 4000),skills text[] not null default '{}',deadline date not null,
 budget_units numeric(20,0) not null check(budget_units>0 and budget_units<=1000000000000),
 status text not null default 'draft' check(status in ('draft','published','offered','active','completed')),
 worker_id uuid references public.profiles(id),current_offer_id uuid,created_at timestamptz not null default now()
);
create table public.paid_milestones (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.paid_projects(id),position integer not null check(position between 1 and 20),
 title text not null check(length(trim(title)) between 3 and 160),deliverables text not null check(length(trim(deliverables)) between 20 and 4000),
 deadline date not null,amount_units numeric(20,0) not null check(amount_units>0 and amount_units<=1000000000000),
 work_status text not null default 'not_submitted' check(work_status in ('not_submitted','submitted','revisions','approved')),
 current_submission_id uuid,approval_id uuid,unique(project_id,position)
);
create table public.paid_project_applications (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.paid_projects(id),worker_id uuid not null references public.profiles(id),
 applicant_name text not null,pitch text not null check(length(trim(pitch)) between 20 and 4000),
 evidence_url text not null check(evidence_url ~ '^https?://'),status text not null default 'applied' check(status in ('applied','selected','declined','rejected')),
 created_at timestamptz not null default now(),unique(project_id,worker_id)
);
create table public.paid_project_offers (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.paid_projects(id),worker_id uuid not null references public.profiles(id),
 version integer not null,terms jsonb not null,terms_hash text not null check(terms_hash ~ '^[a-f0-9]{64}$'),
 response text not null default 'pending' check(response in ('pending','accepted','declined')),responded_at timestamptz,
 created_at timestamptz not null default now(),unique(project_id,version)
);
alter table public.paid_projects add foreign key(current_offer_id) references public.paid_project_offers(id);
create table public.paid_milestone_submissions (
 id uuid primary key default gen_random_uuid(),milestone_id uuid not null references public.paid_milestones(id),worker_id uuid not null references public.profiles(id),
 explanation text not null check(length(trim(explanation)) between 20 and 5000),evidence_url text not null check(evidence_url ~ '^https?://'),created_at timestamptz not null default now()
);
create table public.paid_milestone_reviews (
 id uuid primary key default gen_random_uuid(),milestone_id uuid not null references public.paid_milestones(id),submission_id uuid not null references public.paid_milestone_submissions(id),
 reviewer_id uuid not null references auth.users(id),decision text not null check(decision in ('approved','revisions')),
 feedback text not null check(length(trim(feedback)) between 10 and 2000),created_at timestamptz not null default now(),unique(submission_id)
);
alter table public.paid_milestones add foreign key(current_submission_id) references public.paid_milestone_submissions(id);
alter table public.paid_milestones add foreign key(approval_id) references public.paid_milestone_reviews(id);
create function public.paid_project_party(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.paid_projects p where p.id=p_project and (p.worker_id=auth.uid() or public.is_company_member(p.company_id)));$$;
create function public.paid_milestone_party(p_milestone uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.paid_milestones m where m.id=p_milestone and public.paid_project_party(m.project_id));$$;
alter table public.paid_projects enable row level security;
alter table public.paid_milestones enable row level security;
alter table public.paid_project_applications enable row level security;
alter table public.paid_project_offers enable row level security;
alter table public.paid_milestone_submissions enable row level security;
alter table public.paid_milestone_reviews enable row level security;
create policy paid_projects_read on public.paid_projects for select using(status<>'draft' or public.is_company_member(company_id));
create policy paid_milestones_read on public.paid_milestones for select using(exists(select 1 from public.paid_projects p where p.id=project_id and (p.status<>'draft' or public.is_company_member(p.company_id))));
create policy paid_applications_read on public.paid_project_applications for select to authenticated using(worker_id=auth.uid() or exists(select 1 from public.paid_projects p where p.id=project_id and public.is_company_member(p.company_id)));
create policy paid_offers_read on public.paid_project_offers for select to authenticated using(worker_id=auth.uid() or exists(select 1 from public.paid_projects p where p.id=project_id and public.is_company_member(p.company_id)));
create policy paid_submissions_read on public.paid_milestone_submissions for select to authenticated using(public.paid_milestone_party(milestone_id));
create policy paid_reviews_read on public.paid_milestone_reviews for select to authenticated using(public.paid_milestone_party(milestone_id));
create function public.create_paid_project(p_company uuid,p_title text,p_description text,p_requirements text,p_skills text[],p_deadline date,p_budget text,p_milestones jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;v_sum numeric;v_item jsonb;v_pos integer=0;begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 if p_deadline<current_date or p_budget !~ '^[0-9]{1,13}$' or jsonb_typeof(p_milestones)<>'array' or jsonb_array_length(p_milestones) not between 1 and 20 then raise exception 'Define a future deadline, budget and one to twenty milestones';end if;
 if cardinality(p_skills)>20 then raise exception 'Choose at most twenty skills';end if;
 insert into public.paid_projects(company_id,title,description,requirements,skills,deadline,budget_units) values(p_company,p_title,p_description,p_requirements,p_skills,p_deadline,p_budget::numeric) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_milestones) loop
  v_pos=v_pos+1;
  if (v_item->>'amount_units') !~ '^[0-9]{1,13}$' or (v_item->>'deadline')::date>p_deadline or (v_item->>'deadline')::date<current_date then raise exception 'Milestone amounts and deadlines must fit the project';end if;
  insert into public.paid_milestones(project_id,position,title,deliverables,deadline,amount_units) values(v_id,v_pos,v_item->>'title',v_item->>'deliverables',(v_item->>'deadline')::date,(v_item->>'amount_units')::numeric);
 end loop;
 select sum(amount_units) into v_sum from public.paid_milestones where project_id=v_id;
 if v_sum<>p_budget::numeric then raise exception 'Milestone amounts must equal the total budget';end if;
 return v_id;end;$$;
create function public.publish_paid_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;begin
 select * into p from public.paid_projects where id=p_project for update;
 if p.id is null or not public.is_company_member(p.company_id) or p.status<>'draft' or p.deadline<current_date then raise exception 'Only an owned draft with a future deadline may be published';end if;
 update public.paid_projects set status='published' where id=p.id;end;$$;
create function public.apply_paid_project(p_project uuid,p_pitch text,p_evidence text) returns void language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;begin
 select * into p from public.paid_projects where id=p_project for share;
 if auth.uid() is null or p.id is null or p.status<>'published' or p.deadline<current_date or public.is_company_member(p.company_id) then raise exception 'This project is not open for your application';end if;
 insert into public.paid_project_applications(project_id,worker_id,applicant_name,pitch,evidence_url) values(p.id,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_pitch,p_evidence);end;$$;
create function public.select_paid_worker(p_application uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare a public.paid_project_applications;p public.paid_projects;v_offer uuid;v_terms jsonb;v_version integer;begin
 select * into a from public.paid_project_applications where id=p_application;
 select * into p from public.paid_projects where id=a.project_id for update;
 if a.id is null or a.status<>'applied' or p.status<>'published' or not public.is_company_member(p.company_id) or a.worker_id=auth.uid() then raise exception 'Select an applicant for your open project';end if;
 select coalesce(max(version),0)+1 into v_version from public.paid_project_offers where project_id=p.id;
 v_terms=jsonb_build_object('version',v_version,'project_id',p.id,'company_id',p.company_id,'company_name',(select name from public.companies where id=p.company_id),'worker_id',a.worker_id,'title',p.title,'description',p.description,'requirements',p.requirements,'skills',p.skills,'deadline',p.deadline,'budget_units',p.budget_units::text,'network','devnet','mint','4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU','decimals',6,'payment_model','direct_after_approval','milestones',(select jsonb_agg(jsonb_build_object('id',m.id,'position',m.position,'title',m.title,'deliverables',m.deliverables,'deadline',m.deadline,'amount_units',m.amount_units::text) order by m.position) from public.paid_milestones m where m.project_id=p.id));
 insert into public.paid_project_offers(project_id,worker_id,version,terms,terms_hash) values(p.id,a.worker_id,v_version,v_terms,encode(sha256(convert_to(v_terms::text,'UTF8')),'hex')) returning id into v_offer;
 update public.paid_project_applications set status='selected' where id=a.id;
 update public.paid_projects set status='offered',worker_id=a.worker_id,current_offer_id=v_offer where id=p.id;
 return v_offer;end;$$;
create function public.respond_paid_offer(p_offer uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
 declare o public.paid_project_offers;p public.paid_projects;begin
 select * into o from public.paid_project_offers where id=p_offer;
 select * into p from public.paid_projects where id=o.project_id for update;
 if auth.uid() is null or o.worker_id<>auth.uid() or o.id is null or o.response<>'pending' or p.current_offer_id<>o.id or p.status<>'offered' then raise exception 'Only the selected worker can respond to the current offer';end if;
 update public.paid_project_offers set response=case when p_accept then 'accepted' else 'declined' end,responded_at=now() where id=o.id;
 update public.paid_projects set status=case when p_accept then 'active' else 'published' end,worker_id=case when p_accept then o.worker_id else null end,current_offer_id=case when p_accept then o.id else null end where id=p.id;
 if not p_accept then update public.paid_project_applications set status='declined' where project_id=p.id and worker_id=o.worker_id;end if;end;$$;
create function public.submit_paid_milestone(p_milestone uuid,p_explanation text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
 declare m public.paid_milestones;p public.paid_projects;v_id uuid;begin
 select * into m from public.paid_milestones where id=p_milestone for update;
 select * into p from public.paid_projects where id=m.project_id;
 if auth.uid() is null or p.worker_id<>auth.uid() or p.status<>'active' or m.id is null or m.work_status not in ('not_submitted','revisions') then raise exception 'Only the accepted worker can submit or revise this milestone';end if;
 insert into public.paid_milestone_submissions(milestone_id,worker_id,explanation,evidence_url) values(m.id,auth.uid(),p_explanation,p_evidence) returning id into v_id;
 update public.paid_milestones set work_status='submitted',current_submission_id=v_id where id=m.id;
 return v_id;end;$$;
create function public.review_paid_milestone(p_milestone uuid,p_decision text,p_feedback text) returns void language plpgsql security definer set search_path='' as $$
 declare m public.paid_milestones;p public.paid_projects;v_review uuid;begin
 select * into m from public.paid_milestones where id=p_milestone for update;
 select * into p from public.paid_projects where id=m.project_id;
 if m.id is null or not public.is_company_member(p.company_id) or p.worker_id=auth.uid() or p.status<>'active' or m.work_status<>'submitted' then raise exception 'Only the owning company can review a submitted milestone';end if;
 insert into public.paid_milestone_reviews(milestone_id,submission_id,reviewer_id,decision,feedback) values(m.id,m.current_submission_id,auth.uid(),p_decision,p_feedback) returning id into v_review;
 update public.paid_milestones set work_status=p_decision,approval_id=case when p_decision='approved' then v_review else null end where id=m.id;end;$$;
create function public.protect_paid_project_terms() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.company_id,new.title,new.description,new.requirements,new.skills,new.deadline,new.budget_units) is distinct from row(old.company_id,old.title,old.description,old.requirements,old.skills,old.deadline,old.budget_units) then raise exception 'Project terms cannot be silently changed; create a new agreed project instead';end if;
 if old.status in ('active','completed') and row(new.worker_id,new.current_offer_id) is distinct from row(old.worker_id,old.current_offer_id) then raise exception 'Accepted worker and terms are fixed';end if;
 return new;end;$$;
create function public.protect_paid_milestone_terms() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.project_id,new.position,new.title,new.deliverables,new.deadline,new.amount_units) is distinct from row(old.project_id,old.position,old.title,old.deliverables,old.deadline,old.amount_units) then raise exception 'Milestone terms are fixed';end if;
 if old.work_status='approved' and row(new.work_status,new.current_submission_id,new.approval_id) is distinct from row(old.work_status,old.current_submission_id,old.approval_id) then raise exception 'Approved work cannot be rewritten';end if;return new;end;$$;
create function public.protect_paid_offer_terms() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.project_id,new.worker_id,new.version,new.terms,new.terms_hash,new.created_at) is distinct from row(old.project_id,old.worker_id,old.version,old.terms,old.terms_hash,old.created_at) or old.response<>'pending' then raise exception 'Accepted or declined offer cannot be rewritten';end if;return new;end;$$;
create trigger paid_project_terms before update on public.paid_projects for each row execute function public.protect_paid_project_terms();
create trigger paid_milestone_terms before update on public.paid_milestones for each row execute function public.protect_paid_milestone_terms();
create trigger paid_offer_terms before update on public.paid_project_offers for each row execute function public.protect_paid_offer_terms();
create trigger paid_submissions_immutable before update or delete on public.paid_milestone_submissions for each row execute function public.freeze_approved_record();
create trigger paid_reviews_immutable before update or delete on public.paid_milestone_reviews for each row execute function public.freeze_approved_record();
revoke all on public.paid_projects,public.paid_milestones,public.paid_project_applications,public.paid_project_offers,public.paid_milestone_submissions,public.paid_milestone_reviews from anon,authenticated;
grant select on public.paid_projects,public.paid_milestones to anon,authenticated;
grant select on public.paid_project_applications,public.paid_project_offers,public.paid_milestone_submissions,public.paid_milestone_reviews to authenticated;
grant select on public.paid_projects,public.paid_milestones,public.paid_project_applications,public.paid_project_offers,public.paid_milestone_submissions,public.paid_milestone_reviews to service_role;
revoke all on function public.create_paid_project(uuid,text,text,text,text[],date,text,jsonb),public.publish_paid_project(uuid),public.apply_paid_project(uuid,text,text),public.select_paid_worker(uuid),public.respond_paid_offer(uuid,boolean),public.submit_paid_milestone(uuid,text,text),public.review_paid_milestone(uuid,text,text) from public,anon;
grant execute on function public.create_paid_project(uuid,text,text,text,text[],date,text,jsonb),public.publish_paid_project(uuid),public.apply_paid_project(uuid,text,text),public.select_paid_worker(uuid),public.respond_paid_offer(uuid,boolean),public.submit_paid_milestone(uuid,text,text),public.review_paid_milestone(uuid,text,text) to authenticated;
commit;
