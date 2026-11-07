-- Forward-only, conservative opt-in. Public Passport URLs and proofs unchanged.
begin;
alter table public.profiles add column is_discoverable boolean not null default false,
 add column allow_contact_requests boolean not null default false;
alter table public.achievement_sharing add column share_assessment boolean not null default false;
create index profiles_directory_order on public.profiles(full_name,id) where is_public and is_discoverable;
create table public.employer_shortlists (
 company_id uuid not null references public.companies(id),candidate_id uuid not null references public.profiles(id),
 note text not null default '' check(length(note)<=500),saved_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),primary key(company_id,candidate_id)
);
create table public.contact_requests (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 candidate_id uuid not null references public.profiles(id),created_by uuid not null references auth.users(id),
 purpose text not null check(length(trim(purpose)) between 20 and 1000),
 challenge_id uuid references public.challenges(id),paid_project_id uuid references public.paid_projects(id),
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),responded_at timestamptz,
 check(challenge_id is null or paid_project_id is null),unique(company_id,candidate_id)
);
create index contact_requests_company_time on public.contact_requests(company_id,created_at);
create index contact_requests_actor_time on public.contact_requests(created_by,created_at);
create index contact_requests_candidate_pending on public.contact_requests(candidate_id) where status='pending';
create function public.discoverable_candidate(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id and p.is_public and p.is_discoverable);$$;
create function public.contactable_candidate(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_id and p.is_public and p.is_discoverable and p.allow_contact_requests);$$;
alter table public.employer_shortlists enable row level security;
alter table public.contact_requests enable row level security;
create policy shortlist_read on public.employer_shortlists for select to authenticated using(public.is_company_member(company_id) and public.discoverable_candidate(candidate_id));
create policy contact_request_read on public.contact_requests for select to authenticated using(public.is_company_member(company_id) and public.contactable_candidate(candidate_id));
revoke all on public.employer_shortlists,public.contact_requests from public,anon,authenticated,service_role;
grant select on public.employer_shortlists,public.contact_requests to authenticated,service_role;

-- Recipient-safe projection: staff attribution remains internal to the company.
create view public.visible_contact_requests with(security_barrier=true,security_invoker=false) as
 select id,company_id,candidate_id,purpose,challenge_id,paid_project_id,status,created_at,responded_at
 from public.contact_requests where candidate_id=auth.uid() or (public.is_company_member(company_id) and public.contactable_candidate(candidate_id));
revoke all on public.visible_contact_requests from public,anon,authenticated,service_role;
grant select on public.visible_contact_requests to authenticated,service_role;

create function public.set_discovery_preferences(p_discoverable boolean,p_contact boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or p_discoverable is null or p_contact is null then raise exception 'Sign in and choose your preferences';end if;
 update public.profiles set is_discoverable=p_discoverable,allow_contact_requests=p_contact where id=auth.uid();
 if not found then raise exception 'Profile not found';end if;
end;$$;
create function public.save_candidate(p_company uuid,p_candidate uuid,p_note text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 perform 1 from public.profiles where id=p_candidate and is_public and is_discoverable for share;
 if not found then raise exception 'This candidate is not available in the directory';end if;
 if p_note is null or length(p_note)>500 then raise exception 'Use a note of at most 500 characters';end if;
 insert into public.employer_shortlists(company_id,candidate_id,note,saved_by) values(p_company,p_candidate,trim(p_note),auth.uid())
 on conflict(company_id,candidate_id) do update set note=excluded.note,updated_at=now();
end;$$;
create function public.remove_saved_candidate(p_company uuid,p_candidate uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 delete from public.employer_shortlists where company_id=p_company and candidate_id=p_candidate;
end;$$;
create function public.create_contact_request(p_company uuid,p_candidate uuid,p_purpose text,p_challenge uuid default null,p_paid_project uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare v uuid;begin
 if not public.is_company_member(p_company) or auth.uid()=p_candidate then raise exception 'Choose an eligible candidate for your company';end if;
 -- Consistent locks serialize per-person, company and recipient limits/retries.
 perform 1 from public.profiles where id in (auth.uid(),p_candidate) order by id for update;
 perform 1 from public.companies where id=p_company for update;
 if not public.contactable_candidate(p_candidate) then raise exception 'This candidate is not accepting contact requests';end if;
 if exists(select 1 from public.company_memberships where company_id=p_company and user_id=p_candidate) then raise exception 'Use your existing team channel for this company member';end if;
 if p_purpose is null or length(trim(p_purpose)) not between 20 and 1000 then raise exception 'Describe the purpose in 20 to 1000 characters';end if;
 if p_challenge is not null and p_paid_project is not null then raise exception 'Choose at most one opportunity';end if;
 if p_challenge is not null and not exists(select 1 from public.challenges where id=p_challenge and company_id=p_company and status='published' and deadline>=current_date) then raise exception 'Choose your own open published challenge';end if;
 if p_paid_project is not null and not exists(select 1 from public.paid_projects where id=p_paid_project and company_id=p_company and status='published' and deadline>=current_date) then raise exception 'Choose your own open published paid project';end if;
 if exists(select 1 from public.contact_requests where company_id=p_company and candidate_id=p_candidate) then raise exception 'A request already exists for this candidate and company';end if;
 if (select count(*) from public.contact_requests where company_id=p_company and created_at>now()-interval '24 hours')>=10
 or (select count(*) from public.contact_requests where created_by=auth.uid() and created_at>now()-interval '24 hours')>=10
 then raise exception 'Daily contact limit reached. Try again later';end if;
 if (select count(*) from public.contact_requests where candidate_id=p_candidate and status='pending')>=20 then raise exception 'This candidate cannot receive another request right now';end if;
 insert into public.contact_requests(company_id,candidate_id,created_by,purpose,challenge_id,paid_project_id) values(p_company,p_candidate,auth.uid(),trim(p_purpose),p_challenge,p_paid_project) returning id into v;
 return v;end;$$;
create function public.respond_contact_request(p_request uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.contact_requests;begin
 select * into r from public.contact_requests where id=p_request for update;
 if r.id is null or auth.uid() is null or r.candidate_id<>auth.uid() or p_decision is null or p_decision not in ('accepted','declined') then raise exception 'Only the recipient can accept or decline';end if;
 if r.status=p_decision then return;end if;
 if r.status='declined' then raise exception 'This request is already declined';end if;
 if p_decision='accepted' and not public.contactable_candidate(r.candidate_id) then raise exception 'Enable discovery and contact requests before accepting';end if;
 update public.contact_requests set status=p_decision,responded_at=now() where id=r.id;
end;$$;

-- One fixed response shape; every search/filter/count is gated by publication
-- AND explicit discovery consent. No service keys, emails, private evidence,
-- unpublished credentials or private assessment outcomes enter this projection.
create function public.search_passports(p_company uuid,p_query text default '',p_skill text default '',p_credentials boolean default false,p_assessed boolean default false,p_saved boolean default false,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare result jsonb;begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 if p_query is null or p_skill is null or length(p_query)>120 or length(p_skill)>80 or p_page is null or p_page not between 1 and 10000 or p_credentials is null or p_assessed is null or p_saved is null then raise exception 'Use valid search filters and page';end if;
 with eligible as (
 select p.id,p.slug,p.full_name,p.headline,p.skills,p.allow_contact_requests,
 exists(select 1 from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id) as saved,
 (select s.note from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id) as internal_note
 from public.profiles p where p.is_public and p.is_discoverable
 and (p_query='' or position(lower(p_query) in lower(p.full_name||' '||p.headline||' '||array_to_string(p.skills,' ')))>0 or exists(select 1 from public.projects j where j.talent_id=p.id and position(lower(p_query) in lower(j.title||' '||j.description))>0))
 and (p_skill='' or exists(select 1 from unnest(p.skills) s where lower(trim(s))=lower(trim(p_skill))))
 and (not p_saved or exists(select 1 from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id))
 and (not p_credentials or exists(select 1 from public.credentials c join public.credential_preferences cp on cp.credential_id=c.id where c.recipient_id=p.id and cp.acceptance='accepted' and cp.is_public))
 and (not p_assessed or exists(select 1 from public.achievements a join public.achievement_sharing sh on sh.achievement_id=a.id where a.talent_id=p.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0)))
 ), page as (select * from eligible order by full_name,id limit 20 offset (p_page-1)*20), cards as (
 select p.*,coalesce((select jsonb_agg(to_jsonb(j)) from (select id,title,left(description,160) as description from public.projects where talent_id=p.id order by case when p_query<>'' and position(lower(p_query) in lower(title||' '||description))>0 then 0 else 1 end,created_at desc,id limit 2) j),'[]') as projects,
 coalesce((select jsonb_agg(to_jsonb(c)) from (select c.id,c.title,c.issuer_name,case when exists(select 1 from public.credential_events e where e.credential_id=c.id) then 'Revoked' when c.issue_date>current_date then 'Not yet valid' when c.expiry_date<current_date then 'Expired' else 'Current' end as validity from public.credentials c join public.credential_preferences cp on cp.credential_id=c.id where c.recipient_id=p.id and cp.acceptance='accepted' and cp.is_public order by c.created_at desc,c.id limit 2) c),'[]') as credentials,
 coalesce((select jsonb_agg(to_jsonb(a)) from (select a.id,a.title,exists(select 1 from public.achievement_sharing sh where sh.achievement_id=a.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0)) as assessed from public.achievements a where a.talent_id=p.id order by issued_at desc,id limit 2) a),'[]') as achievements
 from page p)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(c) order by c.full_name,c.id) from cards c),'[]'),'total',(select count(*) from eligible),'page',p_page,'page_size',20) into result;
 return result;end;$$;
revoke all on function public.discoverable_candidate(uuid),public.contactable_candidate(uuid),public.set_discovery_preferences(boolean,boolean),public.save_candidate(uuid,uuid,text),public.remove_saved_candidate(uuid,uuid),public.create_contact_request(uuid,uuid,text,uuid,uuid),public.respond_contact_request(uuid,text),public.search_passports(uuid,text,text,boolean,boolean,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function public.discoverable_candidate(uuid),public.contactable_candidate(uuid),public.set_discovery_preferences(boolean,boolean),public.save_candidate(uuid,uuid,text),public.remove_saved_candidate(uuid,uuid),public.create_contact_request(uuid,uuid,text,uuid,uuid),public.respond_contact_request(uuid,text),public.search_passports(uuid,text,text,boolean,boolean,boolean,integer) to authenticated;
notify pgrst,'reload schema';
commit;
