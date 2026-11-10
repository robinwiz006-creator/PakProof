begin;
alter table public.employer_shortlists add column challenge_id uuid references public.challenges(id),add column paid_project_id uuid references public.paid_projects(id),add check(challenge_id is null or paid_project_id is null);
create index shortlist_opportunity on public.employer_shortlists(company_id,challenge_id,paid_project_id,candidate_id);
create index history_discovery on public.passport_history(owner_id,kind) where is_public;
alter table public.contact_requests drop constraint contact_requests_company_id_candidate_id_key;
create unique index contact_general_once on public.contact_requests(company_id,candidate_id) where challenge_id is null and paid_project_id is null;
create unique index contact_challenge_once on public.contact_requests(company_id,candidate_id,challenge_id) where challenge_id is not null;
create unique index contact_project_once on public.contact_requests(company_id,candidate_id,paid_project_id) where paid_project_id is not null;
alter table public.contact_requests add column expires_at timestamptz;
create index contact_expiring on public.contact_requests(candidate_id,expires_at) where status='pending';
-- Same inbox/handoff and RLS; expiry affects pending opportunity invitations only.
create or replace view public.visible_contact_requests with(security_barrier=true,security_invoker=false) as
 select id,company_id,candidate_id,purpose,challenge_id,paid_project_id,
 case when status='pending' and expires_at<=now() then 'expired' else status end as status,created_at,responded_at,expires_at
 from public.contact_requests where candidate_id=auth.uid() or (public.is_company_member(company_id) and public.contactable_candidate(candidate_id));

create function public.save_candidate_for_opportunity(p_company uuid,p_candidate uuid,p_note text,p_challenge uuid default null,p_project uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 if p_challenge is not null and p_project is not null then raise exception 'Choose one opportunity';end if;
 if p_challenge is not null and not exists(select 1 from public.challenges where id=p_challenge and company_id=p_company) then raise exception 'Choose your organization opportunity';end if;
 if p_project is not null and not exists(select 1 from public.paid_projects where id=p_project and company_id=p_company) then raise exception 'Choose your organization opportunity';end if;
 perform public.save_candidate(p_company,p_candidate,p_note);
 update public.employer_shortlists set challenge_id=p_challenge,paid_project_id=p_project where company_id=p_company and candidate_id=p_candidate;
end;$$;
create function public.invite_candidate_to_opportunity(p_company uuid,p_candidate uuid,p_purpose text,p_challenge uuid default null,p_paid_project uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare v uuid;begin
 if not public.is_company_member(p_company) or auth.uid()=p_candidate then raise exception 'Choose an eligible candidate for your company';end if;
 -- Consistent locks serialize per-person, company and recipient limits/retries.
 perform 1 from public.profiles where id in (auth.uid(),p_candidate) order by id for update;
 perform 1 from public.companies where id=p_company for update;
 if not public.contactable_candidate(p_candidate) then raise exception 'This candidate is not accepting contact requests';end if;
 if exists(select 1 from public.company_memberships where company_id=p_company and user_id=p_candidate) then raise exception 'Use your existing team channel for this company member';end if;
 if p_purpose is null or length(trim(p_purpose)) not between 20 and 1000 then raise exception 'Describe the purpose in 20 to 1000 characters';end if;
 if p_challenge is null and p_paid_project is null then raise exception 'Choose an existing opportunity';end if;
 if p_challenge is not null and p_paid_project is not null then raise exception 'Choose at most one opportunity';end if;
 if p_challenge is not null and not exists(select 1 from public.challenges where id=p_challenge and company_id=p_company and status='published' and deadline>=current_date) then raise exception 'Choose your own open published challenge';end if;
 if p_paid_project is not null and not exists(select 1 from public.paid_projects where id=p_paid_project and company_id=p_company and status='published' and deadline>=current_date) then raise exception 'Choose your own open published paid project';end if;
 if exists(select 1 from public.contact_requests where company_id=p_company and candidate_id=p_candidate and challenge_id is not distinct from p_challenge and paid_project_id is not distinct from p_paid_project) then raise exception 'A request already exists for this candidate and company';end if;
 if (select count(*) from public.contact_requests where company_id=p_company and created_at>now()-interval '24 hours')>=10
 or (select count(*) from public.contact_requests where created_by=auth.uid() and created_at>now()-interval '24 hours')>=10
 then raise exception 'Daily contact limit reached. Try again later';end if;
 if (select count(*) from public.contact_requests where candidate_id=p_candidate and status='pending' and (expires_at is null or expires_at>now()))>=20 then raise exception 'This candidate cannot receive another request right now';end if;
 insert into public.contact_requests(company_id,candidate_id,created_by,purpose,challenge_id,paid_project_id) values(p_company,p_candidate,auth.uid(),trim(p_purpose),p_challenge,p_paid_project) returning id into v;
 update public.contact_requests set expires_at=least(now()+interval '14 days',((case when p_challenge is not null then (select deadline from public.challenges where id=p_challenge) else (select deadline from public.paid_projects where id=p_paid_project) end)+1)::timestamptz) where id=v;
 return v;end;$$;
create or replace function public.respond_contact_request(p_request uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.contact_requests;begin
 select * into r from public.contact_requests where id=p_request for update;
 if r.id is null or auth.uid() is null or r.candidate_id<>auth.uid() or p_decision is null or p_decision not in ('accepted','declined') then raise exception 'Only the recipient can accept or decline';end if;
 if r.status=p_decision then return;end if;
 if r.status='pending' and r.expires_at<=now() then raise exception 'Invitation expired';end if;
 if p_decision='accepted' and r.status='pending' then
  if r.challenge_id is not null and not exists(select 1 from public.challenges where id=r.challenge_id and company_id=r.company_id and status='published' and deadline>=current_date) then raise exception 'Opportunity is no longer open';end if;
  if r.paid_project_id is not null and not exists(select 1 from public.paid_projects where id=r.paid_project_id and company_id=r.company_id and status='published' and deadline>=current_date) then raise exception 'Opportunity is no longer open';end if;
 end if;
 if r.status not in ('pending','accepted') then raise exception 'This contact request has ended';end if;
 if p_decision='accepted' and not public.contactable_candidate(r.candidate_id) then raise exception 'Enable discovery and contact requests before accepting';end if;
 update public.contact_requests set status=p_decision,responded_at=now() where id=r.id;end;$$;

-- Internal predicate: no private credential existence oracle is granted to clients.
create function public.discovery_current_credential(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.credentials c join public.credential_preferences cp on cp.credential_id=c.id
 where c.id=p_id and public.discoverable_candidate(c.recipient_id) and cp.acceptance='accepted' and cp.is_public and c.issue_date<=current_date and (c.expiry_date is null or c.expiry_date>=current_date)
 and not exists(select 1 from public.credential_events e where e.credential_id=c.id and e.event_type='revoked')
 and not exists(select 1 from public.credential_corrections x where x.original_id=c.id and x.state='accepted'));
$$;
create function public.search_passports_evidence(p_company uuid,p_query text default '',p_skill text default '',p_credentials boolean default false,p_assessed boolean default false,p_saved boolean default false,p_page integer default 1,p_education text default '',p_experience text default '',p_project text default '',p_category text default '',p_completed boolean default false,p_sort text default 'name',p_opportunity text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare result jsonb;requested text[];begin
 if not public.is_company_member(p_company) then raise exception 'Company membership required';end if;
 if p_query is null or length(p_query)>120 or p_skill is null or length(p_skill)>800 or p_page is null or p_page not between 1 and 10000 or p_education is null or length(p_education)>120 or p_experience is null or length(p_experience)>120 or p_project is null or length(p_project)>120 or p_category is null or (p_category<>'' and p_category not in ('degree','course','workshop','bootcamp','hackathon_participation','hackathon_achievement','certification','company_achievement')) or p_sort is null or p_sort not in ('name','relevance') or p_credentials is null or p_assessed is null or p_saved is null or p_completed is null or p_opportunity is null then raise exception 'Use valid search filters';end if;
 select coalesce(array_agg(distinct lower(trim(s))),'{}') into requested from unnest(string_to_array(p_skill,',')) s where trim(s)<>'';
 if cardinality(requested)>10 or exists(select 1 from unnest(requested) s where length(s)>80) then raise exception 'Choose up to ten skills';end if;
 if p_opportunity<>'' and not (exists(select 1 from public.challenges where company_id=p_company and 'challenge:'||id::text=p_opportunity) or exists(select 1 from public.paid_projects where company_id=p_company and 'project:'||id::text=p_opportunity)) then raise exception 'Choose your organization opportunity';end if;
 with eligible as (
 select p.id,p.slug,p.full_name,p.headline,p.skills,p.allow_contact_requests,
 exists(select 1 from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id) as saved,
 (select s.note from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id) as internal_note,
 (select case when s.challenge_id is not null then 'challenge:'||s.challenge_id::text when s.paid_project_id is not null then 'project:'||s.paid_project_id::text else '' end from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id) as saved_opportunity
 from public.profiles p where p.is_public and p.is_discoverable
 and (p_query='' or position(lower(p_query) in lower(p.full_name||' '||p.headline||' '||array_to_string(p.skills,' ')))>0 or exists(select 1 from public.projects j where j.talent_id=p.id and position(lower(p_query) in lower(j.title||' '||j.description))>0))
 and not exists(select 1 from unnest(requested) wanted where not exists(select 1 from unnest(p.skills) actual where lower(trim(actual))=wanted))
 and (p_education='' or exists(select 1 from public.passport_history h where h.owner_id=p.id and h.is_public and h.kind='education' and position(lower(p_education) in lower(h.organization||' '||h.title||' '||h.field||' '||h.description))>0))
 and (p_experience='' or exists(select 1 from public.passport_history h where h.owner_id=p.id and h.is_public and h.kind='employment' and position(lower(p_experience) in lower(h.organization||' '||h.title||' '||h.description))>0))
 and (p_project='' or exists(select 1 from public.projects j where j.talent_id=p.id and position(lower(p_project) in lower(j.title||' '||j.description))>0))
 and (not p_saved or exists(select 1 from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id))
 and (p_opportunity='' or exists(select 1 from public.employer_shortlists s where s.company_id=p_company and s.candidate_id=p.id and (('challenge:'||s.challenge_id::text=p_opportunity) or ('project:'||s.paid_project_id::text=p_opportunity))))
 and ((not p_credentials and p_category='') or exists(select 1 from public.credentials c where c.recipient_id=p.id and public.discovery_current_credential(c.id) and (p_category='' or c.credential_type=p_category)))
 and (not p_completed or exists(select 1 from public.achievements a where a.talent_id=p.id))
 and (not p_assessed or exists(select 1 from public.achievements a join public.achievement_sharing sh on sh.achievement_id=a.id where a.talent_id=p.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0)))
 ), scored as (
 select p.*,cardinality(requested) as matched_skills,
 (select count(*) from public.projects j where j.talent_id=p.id and ((p_project<>'' and position(lower(p_project) in lower(j.title||' '||j.description))>0) or (p_query<>'' and position(lower(p_query) in lower(j.title||' '||j.description))>0) or exists(select 1 from unnest(j.skills) js where lower(trim(js))=any(requested)))) as matching_projects,
 (select count(*) from public.achievements a join public.achievement_sharing sh on sh.achievement_id=a.id where a.talent_id=p.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0) and ((cardinality(requested)=0 and p_query='') or (p_query<>'' and position(lower(p_query) in lower(a.title))>0) or exists(select 1 from unnest(requested) wanted where position(wanted in lower(a.title))>0))) as assessed_matches,
 (select count(*) from public.credentials c where c.recipient_id=p.id and public.discovery_current_credential(c.id) and (p_category='' or c.credential_type=p_category)) as current_credentials
 from eligible p
 ), page as (
 select * from scored order by case when p_sort='relevance' then matched_skills else 0 end desc,case when p_sort='relevance' then assessed_matches else 0 end desc,case when p_sort='relevance' then matching_projects else 0 end desc,full_name,id limit 20 offset (p_page-1)*20
 ), cards as (
 select p.*,
 coalesce((select jsonb_agg(to_jsonb(h)) from (select kind,organization,title,field,start_date,end_date,ongoing from public.passport_history where owner_id=p.id and is_public order by start_date desc,id limit 4) h),'[]') as history,
 coalesce((select jsonb_agg(to_jsonb(j)) from (select id,title,left(description,160) as description from public.projects where talent_id=p.id order by case when (p_project<>'' and position(lower(p_project) in lower(title||' '||description))>0) or (p_query<>'' and position(lower(p_query) in lower(title||' '||description))>0) then 0 else 1 end,created_at desc,id limit 2) j),'[]') as projects,
 coalesce((select jsonb_agg(to_jsonb(c)) from (select c.id,c.title,c.issuer_name,c.credential_type,o.issuer_status,o.trust_level,o.trust_suspended,
 case when exists(select 1 from public.credential_events e where e.credential_id=c.id and e.event_type='revoked') then 'Revoked' when exists(select 1 from public.credential_corrections x where x.original_id=c.id and x.state='accepted') then 'Superseded' when c.issue_date>current_date then 'Not yet valid' when c.expiry_date<current_date then 'Expired' else 'Current' end as validity
 from public.credentials c join public.credential_preferences cp on cp.credential_id=c.id join public.organizations o on o.id=c.organization_id where c.recipient_id=p.id and cp.acceptance='accepted' and cp.is_public order by c.created_at desc,c.id limit 3) c),'[]') as credentials,
 coalesce((select jsonb_agg(to_jsonb(a)) from (select a.id,a.title,
 exists(select 1 from public.achievement_sharing sh where sh.achievement_id=a.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0)) as assessed,
 (select jsonb_build_object('criteria_count',jsonb_array_length(ca.criteria),'outcomes',ca.outcomes) from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id join public.achievement_sharing sh on sh.achievement_id=a.id where ca.submission_id=a.submission_id and r.decision='approved' and sh.share_assessment order by r.created_at desc,ca.review_id limit 1) as assessment_summary
 from public.achievements a where a.talent_id=p.id order by issued_at desc,id limit 3) a),'[]') as achievements
 from page p)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(c) order by case when p_sort='relevance' then matched_skills else 0 end desc,case when p_sort='relevance' then assessed_matches else 0 end desc,case when p_sort='relevance' then matching_projects else 0 end desc,full_name,id) from cards c),'[]'),'total',(select count(*) from eligible),'page',p_page,'page_size',20) into result;
 return result;end;$$;
-- Existing clients retain the established RPC signature and get the same privacy-safe projection.
create or replace function public.search_passports(p_company uuid,p_query text default '',p_skill text default '',p_credentials boolean default false,p_assessed boolean default false,p_saved boolean default false,p_page integer default 1) returns jsonb language sql stable security definer set search_path='' as $$
 select public.search_passports_evidence(p_company,p_query,p_skill,p_credentials,p_assessed,p_saved,p_page);
$$;
revoke all on function public.save_candidate_for_opportunity(uuid,uuid,text,uuid,uuid),public.invite_candidate_to_opportunity(uuid,uuid,text,uuid,uuid),public.discovery_current_credential(uuid),public.search_passports_evidence(uuid,text,text,boolean,boolean,boolean,integer,text,text,text,text,boolean,text,text) from public,anon,authenticated,service_role;
grant execute on function public.save_candidate_for_opportunity(uuid,uuid,text,uuid,uuid),public.invite_candidate_to_opportunity(uuid,uuid,text,uuid,uuid),public.search_passports_evidence(uuid,text,text,boolean,boolean,boolean,integer,text,text,text,text,boolean,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
