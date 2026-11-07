-- Controlled corrections; no issued facts, claims, proof rows or old migrations rewritten.
begin;
create table public.credential_corrections (
 replacement_id uuid primary key references public.credentials(id),
 original_id uuid not null references public.credentials(id),
 organization_id uuid not null references public.organizations(id),
 created_by uuid not null references auth.users(id),
 reason text not null check(length(trim(reason)) between 10 and 2000),
 state text not null default 'pending' check(state in ('pending','accepted','declined','withdrawn')),
 created_at timestamptz not null default clock_timestamp(),responded_at timestamptz,
 check(original_id<>replacement_id)
);
create unique index one_live_credential_correction on public.credential_corrections(original_id) where state in ('pending','accepted');
alter table public.credential_corrections enable row level security;
create policy correction_staff_audit on public.credential_corrections for select to authenticated
 using(public.organization_member(organization_id) or public.is_platform_administrator());
revoke all on public.credential_corrections from public,anon,authenticated,service_role;
grant select on public.credential_corrections to authenticated,service_role;

create function public.protect_credential_correction() returns trigger language plpgsql security definer set search_path='' as $$
 declare a public.credentials;b public.credentials;begin
 if tg_op='DELETE' then raise exception 'Correction history cannot be deleted';end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['state','responded_at']) is distinct from (to_jsonb(old)-array['state','responded_at'])
  or old.state<>'pending' or new.state not in ('accepted','declined','withdrawn') or new.responded_at is null then raise exception 'Correction decisions and facts are immutable';end if;
  return new;
 end if;
 select * into a from public.credentials where id=new.original_id for update;
 select * into b from public.credentials where id=new.replacement_id;
 if a.id is null or b.id is null or a.id=b.id or a.organization_id<>b.organization_id or a.recipient_id<>b.recipient_id
 or a.credential_type<>b.credential_type or new.organization_id<>a.organization_id or new.created_by is distinct from auth.uid()
 or not public.organization_member(a.organization_id) or new.state<>'pending' or new.responded_at is not null
 or not exists(select 1 from public.credential_issuance_audit x where x.credential_id=b.id and x.representative_id=auth.uid())
 or b.description not like ('%'||E'\n\nCorrection reference sha256:'||encode(sha256(convert_to(a.id::text,'UTF8')),'hex')||'.') then raise exception 'Correction requires a newly attributed same-recipient, same-issuer and same-category record';end if;
 if exists(with recursive ancestors(id) as (select new.original_id union select c.original_id from public.credential_corrections c join ancestors x on c.replacement_id=x.id) select 1 from ancestors where id=new.replacement_id) then raise exception 'Correction cycle denied';end if;
 return new;end;$$;
create trigger correction_facts before insert or update or delete on public.credential_corrections for each row execute function public.protect_credential_correction();

-- Keep one initial credential per work/type. Replacements must inherit the exact
-- original approved source through a validated correction edge.
alter table public.challenge_credential_sources add column correction_root_id uuid references public.credentials(id);
alter table public.challenge_credential_sources drop constraint challenge_credential_sources_submission_id_credential_type_key;
create unique index one_initial_work_credential on public.challenge_credential_sources(submission_id,credential_type) where correction_root_id is null;
create function public.guard_corrected_work_source() returns trigger language plpgsql security definer set search_path='' as $$
 declare edge public.credential_corrections;src public.challenge_credential_sources;begin
 select * into edge from public.credential_corrections where replacement_id=new.credential_id;
 if new.correction_root_id is null then
  if edge.replacement_id is not null then raise exception 'A corrected source requires its original root';end if;return new;
 end if;
 select * into src from public.challenge_credential_sources where credential_id=edge.original_id;
 if edge.replacement_id is null or src.credential_id is null or new.correction_root_id<>coalesce(src.correction_root_id,src.credential_id)
 or row(new.submission_id,new.challenge_id,new.review_id,new.organization_id,new.credential_type,new.manifest,new.context_digest)
 is distinct from row(src.submission_id,src.challenge_id,src.review_id,src.organization_id,src.credential_type,src.manifest,src.context_digest)
 then raise exception 'Correction must retain its exact approved assessment source';end if;return new;end;$$;
create trigger corrected_work_source before insert on public.challenge_credential_sources for each row execute function public.guard_corrected_work_source();

create function public.correct_credential(p_original uuid,p_reason text,p_title text,p_description text,p_issue_date date,p_expiry_date date,p_program text,p_award text,p_evidence text) returns uuid
 language plpgsql security definer set search_path='' as $$
 declare a public.credentials;o public.organizations;e public.credential_evidence;s public.challenge_credential_sources;v uuid=gen_random_uuid();salt uuid=gen_random_uuid();begin
 select * into a from public.credentials where id=p_original for update;
 select * into o from public.organizations where id=a.organization_id for share;
 if a.id is null or auth.uid() is null or not public.organization_member(o.id) or o.issuer_status<>'authorized'
 or not coalesce(a.credential_type=any(o.allowed_credential_types),false) or a.recipient_id=auth.uid() then raise exception 'Authorized issuer membership and current category permission are required';end if;
 if exists(select 1 from public.credential_corrections where original_id=a.id and state in ('pending','accepted')) then raise exception 'This credential already has an open or accepted replacement; correct the current accepted record';end if;
 if exists(select 1 from public.credential_corrections where replacement_id=a.id and state<>'accepted') then raise exception 'Only an initial or previously accepted record can be corrected';end if;
 if (with recursive ancestors(id) as (select a.id union select c.original_id from public.credential_corrections c join ancestors x on c.replacement_id=x.id) select count(*) from ancestors)>=20 then raise exception 'Correction chain requires operator review';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 2000 or p_description is null or length(trim(p_description)) not between 20 and 3850 then raise exception 'Provide a private reason and a clear corrected description';end if;
 select * into e from public.credential_evidence where credential_id=a.id;
 select * into s from public.challenge_credential_sources where credential_id=a.id;
 if s.credential_id is not null and (p_program is distinct from a.program_name or p_evidence is distinct from e.evidence_url) then raise exception 'Approved work program and evidence cannot be replaced';end if;
 insert into public.credentials(id,organization_id,authorization_id,recipient_id,issuer_name,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_digest)
 values(v,o.id,o.authorization_id,a.recipient_id,(select name from public.companies where id=o.company_id),p_title,a.credential_type,trim(p_description)||E'\n\nCorrection reference sha256:'||encode(sha256(convert_to(a.id::text,'UTF8')),'hex')||'.',p_issue_date,p_expiry_date,coalesce(p_program,''),coalesce(p_award,''),encode(sha256(convert_to(jsonb_build_array(salt::text,coalesce(p_evidence,''))::text,'UTF8')),'hex'));
 insert into public.credential_evidence(credential_id,evidence_url,digest_salt) values(v,coalesce(p_evidence,''),salt);
 insert into public.credential_preferences(credential_id) values(v);
 insert into public.credential_corrections(replacement_id,original_id,organization_id,created_by,reason) values(v,a.id,o.id,auth.uid(),trim(p_reason));
 if s.credential_id is not null then
 insert into public.challenge_credential_sources(credential_id,submission_id,challenge_id,review_id,organization_id,credential_type,manifest,context_digest,correction_root_id)
 values(v,s.submission_id,s.challenge_id,s.review_id,s.organization_id,s.credential_type,s.manifest,s.context_digest,coalesce(s.correction_root_id,s.credential_id));
 end if;return v;end;$$;

create function public.decide_credential_correction() returns trigger language plpgsql security definer set search_path='' as $$
 declare edge public.credential_corrections;c public.credentials;o public.organizations;begin
 select * into edge from public.credential_corrections where replacement_id=new.credential_id;
 if edge.replacement_id is null then return new;end if;
 perform 1 from public.credentials where id=edge.original_id for update;
 select * into edge from public.credential_corrections where replacement_id=new.credential_id for update;
 select * into c from public.credentials where id=new.credential_id;
 if c.recipient_id is distinct from auth.uid() then raise exception 'Only the recipient can decide on the replacement';end if;
 if new.acceptance='accepted' and edge.state in ('declined','withdrawn') then raise exception 'This replacement was closed; ask the issuer for a new correction';end if;
 if edge.state='pending' and new.acceptance in ('accepted','declined') then
  if new.acceptance='accepted' then
   select * into o from public.organizations where id=c.organization_id for share;
   if c.issue_date>current_date or c.expiry_date<current_date or exists(select 1 from public.credential_events where credential_id=c.id)
   or o.issuer_status<>'authorized' or not coalesce(c.credential_type=any(o.allowed_credential_types),false) then raise exception 'Only a current non-revoked correction from a currently permitted issuer can supersede the original';end if;
  end if;
  update public.credential_corrections set state=new.acceptance,responded_at=clock_timestamp() where replacement_id=c.id;
 end if;return new;end;$$;
create trigger correction_recipient_decision before update on public.credential_preferences for each row execute function public.decide_credential_correction();
create function public.withdraw_revoked_correction() returns trigger language plpgsql security definer set search_path='' as $$begin
 update public.credential_corrections set state='withdrawn',responded_at=clock_timestamp() where replacement_id=new.credential_id and state='pending';
 return new;end;$$;
create trigger revoke_pending_correction after insert on public.credential_events for each row execute function public.withdraw_revoked_correction();

-- A callable helper returns only a visible successor of a visible original.
create function public.credential_replacement_tip(p_credential uuid) returns uuid language sql stable security definer set search_path='' as $$
 with recursive path(id,depth) as (select p_credential,0 union all select c.replacement_id,p.depth+1 from path p join public.credential_corrections c on c.original_id=p.id and c.state='accepted' where p.depth<20)
 select id from (select id from path order by depth desc limit 1) tip where public.visible_credential(p_credential) and public.visible_credential(tip.id);$$;
create view public.credential_correction_status with(security_barrier=true,security_invoker=false) as
 select c.id as credential_id,
 exists(select 1 from public.credential_corrections x where x.replacement_id=c.id) as is_replacement,
 (select x.original_id from public.credential_corrections x where x.replacement_id=c.id and public.visible_credential(x.original_id)) as replaces_id,
 exists(select 1 from public.credential_corrections x where x.original_id=c.id and x.state='accepted') as superseded,
 case when (c.recipient_id=auth.uid() or public.organization_member(c.organization_id))
 then (select x.replacement_id from public.credential_corrections x where x.original_id=c.id and x.state='pending') end as pending_replacement_id,
 case when public.credential_replacement_tip(c.id)<>c.id and public.visible_credential(public.credential_replacement_tip(c.id)) then public.credential_replacement_tip(c.id) end as replacement_id,
 case when c.recipient_id=auth.uid() or public.organization_member(c.organization_id) then (select x.state from public.credential_corrections x where x.replacement_id=c.id) end as incoming_state
 from public.credentials c where public.visible_credential(c.id);
revoke all on public.credential_correction_status from public,anon,authenticated,service_role;
grant select on public.credential_correction_status to anon,authenticated,service_role;
revoke all on function public.protect_credential_correction(),public.guard_corrected_work_source(),public.decide_credential_correction(),public.withdraw_revoked_correction(),public.credential_replacement_tip(uuid),public.correct_credential(uuid,text,text,text,date,date,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.credential_replacement_tip(uuid) to anon,authenticated,service_role;
grant execute on function public.correct_credential(uuid,text,text,text,date,date,text,text,text) to authenticated;
create or replace function public.record_credential_proof(p_credential uuid,p_signature text,p_hash text,p_wallet text,p_anchored timestamptz) returns void language plpgsql security definer set search_path='' as $$
 declare c public.credentials;begin
 select * into c from public.credentials where id=p_credential for share;
 if c.id is null or not exists(select 1 from public.organizations where id=c.organization_id and issuer_status='authorized')
 or exists(select 1 from public.credential_events where credential_id=c.id)
 or exists(select 1 from public.credential_corrections where original_id=c.id and state='accepted')
 or not exists(select 1 from public.credential_preferences where credential_id=c.id and acceptance='accepted')
 or c.issue_date>current_date
 or (c.expiry_date is not null and c.expiry_date<current_date)
 then raise exception 'Only accepted, current credentials from authorized issuers may be anchored';end if;
 if p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$' or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' or p_anchored>now()+interval '1 minute' then raise exception 'Invalid proof receipt';end if;
 insert into public.credential_proofs(credential_id,signature,record_hash,issuer_wallet,anchored_at) values(c.id,p_signature,p_hash,p_wallet,p_anchored);
 end; $$;
create or replace function public.search_passports(p_company uuid,p_query text default '',p_skill text default '',p_credentials boolean default false,p_assessed boolean default false,p_saved boolean default false,p_page integer default 1)
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
 coalesce((select jsonb_agg(to_jsonb(c)) from (select c.id,c.title,c.issuer_name,case when exists(select 1 from public.credential_events e where e.credential_id=c.id) then 'Revoked' when exists(select 1 from public.credential_corrections x where x.original_id=c.id and x.state='accepted') then 'Superseded' when c.issue_date>current_date then 'Not yet valid' when c.expiry_date<current_date then 'Expired' else 'Current' end as validity from public.credentials c join public.credential_preferences cp on cp.credential_id=c.id where c.recipient_id=p.id and cp.acceptance='accepted' and cp.is_public order by c.created_at desc,c.id limit 2) c),'[]') as credentials,
 coalesce((select jsonb_agg(to_jsonb(a)) from (select a.id,a.title,exists(select 1 from public.achievement_sharing sh where sh.achievement_id=a.id and sh.share_assessment and exists(select 1 from public.challenge_assessments ca join public.submission_reviews r on r.id=ca.review_id where ca.submission_id=a.submission_id and r.decision='approved' and jsonb_array_length(ca.criteria)>0)) as assessed from public.achievements a where a.talent_id=p.id order by issued_at desc,id limit 2) a),'[]') as achievements
 from page p)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(c) order by c.full_name,c.id) from cards c),'[]'),'total',(select count(*) from eligible),'page',p_page,'page_size',20) into result;
 return result;end;$$;
-- Explicit computed relationship avoids unreliable FK inference through this
-- privacy projection's correlated subqueries. ROWS 1 matches one status per ID.
create function public.credential_correction_status(public.credentials) returns setof public.credential_correction_status rows 1 language sql stable set search_path='' as $$
 select * from public.credential_correction_status where credential_id=($1).id;$$;
revoke all on function public.credential_correction_status(public.credentials) from public,anon,authenticated,service_role;
grant execute on function public.credential_correction_status(public.credentials) to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
