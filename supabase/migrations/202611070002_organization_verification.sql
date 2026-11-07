-- Independent trust review on existing organizations and authorization audit.
-- Does not grant categories, promote historical issuers or rewrite claims.
begin;
create table public.organization_verification_requests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 submitted_by uuid not null references auth.users(id),identity_statement text not null check(length(trim(identity_statement)) between 20 and 2000),
 representative_role text not null check(length(trim(representative_role)) between 3 and 200),
 identity_evidence_url text not null check(identity_evidence_url ~ '^https://[^[:space:]]+$' and length(identity_evidence_url)<=2048),
 assessment_statement text not null default '' check(length(assessment_statement)<=2000),
 assessment_evidence_url text not null default '' check(assessment_evidence_url='' or (assessment_evidence_url ~ '^https://[^[:space:]]+$' and length(assessment_evidence_url)<=2048)),
 identity_digest text not null,created_at timestamptz not null default clock_timestamp()
);
create index verification_requests_org_time on public.organization_verification_requests(organization_id,created_at);
alter table public.organization_verification_requests enable row level security;
create policy verification_request_private on public.organization_verification_requests for select to authenticated using(public.organization_member(organization_id) or public.is_platform_administrator());
revoke all on public.organization_verification_requests from public,anon,authenticated,service_role;
grant select on public.organization_verification_requests to authenticated,service_role;
create trigger verification_request_immutable before update or delete on public.organization_verification_requests for each row execute function public.freeze_approved_record();
alter table public.organizations add column trust_level text not null default 'self_registered' check(trust_level in ('self_registered','verified_organization','trusted_assessment_partner')),
 add column trust_suspended boolean not null default false,
 add column trust_review_id uuid references public.issuer_authorizations(id);
alter table public.issuer_authorizations add column trust_decision text check(trust_decision in ('approve','reject','suspend','downgrade')),
 add column previous_trust_level text,add column resulting_trust_level text,
 add column previous_trust_review_id uuid references public.issuer_authorizations(id),
 add column resulting_trust_suspended boolean,add column verification_request_id uuid references public.organization_verification_requests(id);
create unique index one_initial_institutional_review on public.issuer_authorizations(organization_id) where trust_decision is not null and previous_trust_review_id is null;
create unique index one_institutional_review_successor on public.issuer_authorizations(previous_trust_review_id) where trust_decision is not null and previous_trust_review_id is not null;
create function public.protect_organization_trust() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='INSERT' then
 if new.trust_level<>'self_registered' or new.trust_suspended or new.trust_review_id is not null then raise exception 'New organizations must start self-registered';end if;return new;end if;
 if row(new.trust_level,new.trust_suspended,new.trust_review_id) is distinct from row(old.trust_level,old.trust_suspended,old.trust_review_id) then
 if not public.is_platform_administrator() or public.organization_member(old.id) or new.trust_review_id is null
 or not exists(select 1 from public.issuer_authorizations a where a.id=new.trust_review_id and a.organization_id=old.id and a.administrator_id=auth.uid() and a.trust_decision is not null and a.id is distinct from old.trust_review_id and a.previous_trust_review_id is not distinct from old.trust_review_id and a.previous_trust_level=old.trust_level and a.resulting_trust_level=new.trust_level and a.resulting_trust_suspended=new.trust_suspended)
 then raise exception 'A separate administrator trust decision is required';end if;end if;return new;end;$$;
create trigger organization_trust_guard before insert or update on public.organizations for each row execute function public.protect_organization_trust();
create or replace function public.protect_reviewed_organization_identity() returns trigger language plpgsql security definer set search_path='' as $$begin
 if (new.name is distinct from old.name or new.website is distinct from old.website or new.description is distinct from old.description)
 and exists(select 1 from public.organizations where company_id=old.id and (authorization_id is not null or trust_level<>'self_registered' or trust_suspended))
 then raise exception 'Reviewed organization identity is locked. Ask an administrator to arrange a new identity review';end if;return new;end;$$;
create function public.submit_organization_verification(p_organization uuid,p_identity text,p_role text,p_identity_url text,p_assessment text,p_assessment_url text) returns uuid language plpgsql security definer set search_path='' as $$
 declare o public.organizations;c public.companies;v uuid;begin
 select * into o from public.organizations where id=p_organization for update;
 if o.id is null or auth.uid() is null or not public.organization_member(o.id) then raise exception 'Organization membership required';end if;
 if exists(select 1 from public.organization_verification_requests r where r.organization_id=o.id and not exists(select 1 from public.issuer_authorizations a where a.verification_request_id=r.id and a.trust_decision is not null)) then raise exception 'Your current verification request is awaiting review';end if;
 if (select count(*) from public.organization_verification_requests where organization_id=o.id and created_at>now()-interval '24 hours')>=3 then raise exception 'Verification request limit reached. Try later';end if;
 select * into c from public.companies where id=o.company_id for share;
 insert into public.organization_verification_requests(organization_id,submitted_by,identity_statement,representative_role,identity_evidence_url,assessment_statement,assessment_evidence_url,identity_digest)
 values(o.id,auth.uid(),trim(p_identity),trim(p_role),trim(p_identity_url),coalesce(trim(p_assessment),''),coalesce(trim(p_assessment_url),''),encode(sha256(convert_to(jsonb_build_array(c.name,c.description,c.website,o.organization_type)::text,'UTF8')),'hex')) returning id into v;
 return v;end;$$;
create function public.review_organization_verification(p_organization uuid,p_request uuid,p_expected_review uuid,p_decision text,p_level text,p_reason text,p_identity_checked boolean,p_assessment_checked boolean) returns void language plpgsql security definer set search_path='' as $$
 declare o public.organizations;c public.companies;r public.organization_verification_requests;level text;suspended boolean;v uuid;digest text;begin
 if not public.is_platform_administrator() or public.organization_member(p_organization) then raise exception 'Independent administrator review required';end if;
 select * into o from public.organizations where id=p_organization for update;
 if o.id is null or o.trust_review_id is distinct from p_expected_review then raise exception 'Trust review changed. Reload before deciding';end if;
 if p_decision is null or p_decision not in ('approve','reject','suspend','downgrade') or p_level is null or p_level not in ('self_registered','verified_organization','trusted_assessment_partner') or p_reason is null or length(trim(p_reason)) not between 20 and 2000 then raise exception 'Choose a supported decision and record a private reason';end if;
 select * into c from public.companies where id=o.company_id for share;
 digest=encode(sha256(convert_to(jsonb_build_array(c.name,c.description,c.website,o.organization_type)::text,'UTF8')),'hex');
 if p_decision in ('approve','reject') then
 select * into r from public.organization_verification_requests where id=p_request and organization_id=o.id;
 if r.id is null or r.id is distinct from (select id from public.organization_verification_requests where organization_id=o.id order by created_at desc,id desc limit 1) or exists(select 1 from public.issuer_authorizations where verification_request_id=r.id and trust_decision is not null) then raise exception 'Review the current undecided verification request';end if;
 elsif p_request is not null then raise exception 'Suspension and downgrade are independent of request decisions';end if;
 level=o.trust_level;suspended=o.trust_suspended;
 if p_decision='approve' then
 if p_identity_checked is distinct from true or r.identity_digest<>digest or p_level='self_registered' then raise exception 'Confirm current institutional identity and representative authority before approval';end if;
 if p_level='trusted_assessment_partner' and (p_assessment_checked is distinct from true or length(trim(r.assessment_statement))<20 or r.assessment_evidence_url='') then raise exception 'Assessment standards and supporting evidence require a separate review';end if;
 if o.trust_level='trusted_assessment_partner' and p_level='verified_organization' then raise exception 'Use an explicit downgrade for lower trust';end if;
 level=p_level;suspended=false;
 elsif p_decision='suspend' then level='self_registered';suspended=true;
 elsif p_decision='downgrade' then
 if not ((o.trust_level='trusted_assessment_partner' and p_level in ('verified_organization','self_registered')) or (o.trust_level='verified_organization' and p_level='self_registered')) then raise exception 'Downgrade must lower current trust';end if;
 level=p_level;suspended=false;end if;
 insert into public.issuer_authorizations(organization_id,administrator_id,identity_digest,review_note,decision,previous_status,resulting_status,previous_credential_types,allowed_credential_types,trust_decision,previous_trust_level,resulting_trust_level,resulting_trust_suspended,verification_request_id,previous_trust_review_id)
 values(o.id,auth.uid(),digest,trim(p_reason),'review',o.issuer_status,o.issuer_status,o.allowed_credential_types,o.allowed_credential_types,p_decision,o.trust_level,level,suspended,r.id,o.trust_review_id) returning id into v;
 update public.organizations set trust_level=level,trust_suspended=suspended,trust_review_id=v where id=o.id;
 end;$$;
-- Safe member outcome only: no private admin reason or staff identifier.
create view public.organization_verification_outcomes with(security_barrier=true,security_invoker=false) as
 select organization_id,verification_request_id,trust_decision,resulting_trust_level,created_at from public.issuer_authorizations where trust_decision is not null and (public.organization_member(organization_id) or public.is_platform_administrator());
revoke all on public.organization_verification_outcomes from public,anon,authenticated,service_role;
grant select on public.organization_verification_outcomes to authenticated,service_role;
revoke all on function public.protect_organization_trust(),public.submit_organization_verification(uuid,text,text,text,text,text),public.review_organization_verification(uuid,uuid,uuid,text,text,text,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.submit_organization_verification(uuid,text,text,text,text,text),public.review_organization_verification(uuid,uuid,uuid,text,text,text,boolean,boolean) to authenticated;
create view public.administrator_verification_queue with(security_barrier=true,security_invoker=false) as
 select o.id,o.company_id,o.organization_type,o.issuer_status,o.trust_level,o.trust_suspended,o.created_at,c.name as company_name,jsonb_build_object('name',c.name,'description',c.description,'website',c.website) as companies
 from public.organizations o join public.companies c on c.id=o.company_id
 where public.is_platform_administrator() and exists(select 1 from public.organization_verification_requests r where r.organization_id=o.id and not exists(select 1 from public.issuer_authorizations a where a.verification_request_id=r.id and a.trust_decision is not null));
revoke all on public.administrator_verification_queue from public,anon,authenticated,service_role;
grant select on public.administrator_verification_queue to authenticated,service_role;
notify pgrst,'reload schema';
commit;
