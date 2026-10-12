-- Additive. Apply AFTER 202610120001_passport_foundation.sql. Never reapply.
begin;
create table public.platform_administrators (
 user_id uuid primary key references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null unique references public.companies(id) on delete restrict,
 organization_type text not null check(organization_type in ('university','training','community','hackathon','company','other')),
 issuer_status text not null default 'pending' check(issuer_status in ('pending','authorized','suspended')),
 authorization_id uuid,
 created_at timestamptz not null default now()
);
create table public.issuer_authorizations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 administrator_id uuid not null references auth.users(id), identity_digest text not null check(identity_digest ~ '^[0-9a-f]{64}$'), review_note text not null check(length(trim(review_note)) between 20 and 2000),
 created_at timestamptz not null default now()
);
alter table public.organizations add constraint organization_authorization_fk foreign key(authorization_id) references public.issuer_authorizations(id);
create table public.credentials (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 authorization_id uuid not null references public.issuer_authorizations(id), recipient_id uuid not null references public.profiles(id),
 issuer_name text not null, title text not null check(length(trim(title)) between 3 and 160),
 credential_type text not null check(credential_type in ('degree','course','workshop','bootcamp','hackathon_participation','hackathon_achievement','certification','company_achievement')),
 description text not null check(length(trim(description)) between 20 and 4000),
 issue_date date not null, expiry_date date check(expiry_date is null or expiry_date>=issue_date),
 program_name text not null default '' check(length(program_name)<=200), award text not null default '' check(length(award)<=200),
 evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now()
);
create table public.credential_evidence (
 credential_id uuid primary key references public.credentials(id),
 evidence_url text not null default '' check(evidence_url='' or evidence_url ~ '^https?://'),
 digest_salt uuid not null default gen_random_uuid()
);
create table public.credential_preferences (
 credential_id uuid primary key references public.credentials(id),
 acceptance text not null default 'pending' check(acceptance in ('pending','accepted','declined')),
 is_public boolean not null default false, share_evidence boolean not null default false,
 updated_at timestamptz not null default now(), check(acceptance='accepted' or not is_public)
);
create table public.credential_events (
 id uuid primary key default gen_random_uuid(), credential_id uuid not null references public.credentials(id),
 actor_id uuid not null references auth.users(id), event_type text not null check(event_type in ('revoked')),
 reason text not null check(length(trim(reason)) between 10 and 2000), created_at timestamptz not null default now(),
 unique(credential_id,event_type)
);
create table public.qualification_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 recipient_id uuid not null references public.profiles(id), recipient_name text not null, title text not null check(length(trim(title)) between 3 and 160),
 description text not null check(length(trim(description)) between 20 and 4000),
 issue_date date not null, evidence_url text not null check(evidence_url ~ '^https?://'),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 feedback text not null default '', reviewer_id uuid references auth.users(id), credential_id uuid unique references public.credentials(id),
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index credentials_recipient_idx on public.credentials(recipient_id);
create index credentials_organization_idx on public.credentials(organization_id);
create index qualification_requests_organization_idx on public.qualification_requests(organization_id);
create function public.is_platform_administrator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.platform_administrators where user_id=auth.uid()); $$;
create function public.organization_member(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o where o.id=p_id and public.is_company_member(o.company_id)); $$;
create function public.visible_credential(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.credentials c join public.credential_preferences p on p.credential_id=c.id
 where c.id=p_id and (c.recipient_id=auth.uid() or public.organization_member(c.organization_id)
 or (p.acceptance='accepted' and p.is_public and public.public_talent(c.recipient_id)))); $$;
alter table public.platform_administrators enable row level security;
alter table public.organizations enable row level security;
alter table public.issuer_authorizations enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_evidence enable row level security;
alter table public.credential_preferences enable row level security;
alter table public.credential_events enable row level security;
alter table public.qualification_requests enable row level security;
create policy administrators_read on public.platform_administrators for select to authenticated using(user_id=auth.uid());
create policy organizations_read on public.organizations for select using(true);
create policy authorizations_read on public.issuer_authorizations for select to authenticated using(public.is_platform_administrator());
create policy credentials_read on public.credentials for select using(public.visible_credential(id));
create policy preferences_read on public.credential_preferences for select using(public.visible_credential(credential_id));
create policy credential_events_read on public.credential_events for select using(public.visible_credential(credential_id));
create policy credential_evidence_read on public.credential_evidence for select using(exists(
 select 1 from public.credentials c join public.credential_preferences p on p.credential_id=c.id
 where c.id=credential_evidence.credential_id and (c.recipient_id=auth.uid() or public.organization_member(c.organization_id)
 or (p.acceptance='accepted' and p.is_public and p.share_evidence and public.public_talent(c.recipient_id)))));
create policy qualification_requests_read on public.qualification_requests for select to authenticated using(recipient_id=auth.uid() or public.organization_member(organization_id));
create function public.protect_reviewed_organization_identity() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if (new.name is distinct from old.name or new.website is distinct from old.website or new.description is distinct from old.description)
 and exists(select 1 from public.organizations where company_id=old.id and authorization_id is not null)
 then raise exception 'Reviewed organization identity is locked. Ask an administrator to arrange a new identity review';end if;
 return new;end; $$;
create trigger reviewed_organization_identity before update on public.companies for each row execute function public.protect_reviewed_organization_identity();
-- All writes go through narrowly scoped, permission-checked functions. No client write policies.
create function public.register_organization(p_type text,p_name text,p_description text,p_website text,p_company_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_company uuid; v_org uuid; begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if p_company_id is null then v_company=public.create_company(p_name,p_description,p_website,'');
 else
  if not public.is_company_owner(p_company_id) then raise exception 'Only the company owner can register this organization';end if;
  v_company=p_company_id;
 end if;
 insert into public.organizations(company_id,organization_type) values(v_company,p_type) returning id into v_org;
 return v_org; end; $$;
create function public.authorize_issuer(p_organization uuid,p_note text,p_authorize boolean,p_name text,p_description text,p_website text) returns void language plpgsql security definer set search_path='' as $$
 declare v_id uuid; c public.companies; begin
 if not public.is_platform_administrator() then raise exception 'Administrator access required';end if;
 if public.organization_member(p_organization) then raise exception 'Administrators cannot authorize an organization they belong to';end if;
 perform 1 from public.organizations where id=p_organization for update;
 if not found then raise exception 'Organization not found';end if;
 select * into c from public.companies where id=(select company_id from public.organizations where id=p_organization) for update;
 if c.name is distinct from p_name or c.description is distinct from p_description or c.website is distinct from p_website then raise exception 'Organization identity changed since review. Reload and review again';end if;
 if length(trim(p_note)) not between 20 and 2000 then raise exception 'Record your identity review and evidence';end if;
 insert into public.issuer_authorizations(organization_id,administrator_id,review_note,identity_digest) values(p_organization,auth.uid(),p_note,encode(sha256(convert_to(jsonb_build_array(c.name,c.description,c.website)::text,'UTF8')),'hex')) returning id into v_id;
 update public.organizations set issuer_status=case when p_authorize then 'authorized' else 'suspended' end, authorization_id=v_id where id=p_organization;
 end; $$;
create function public.issue_credential(p_organization uuid,p_recipient uuid,p_title text,p_type text,p_description text,p_issue_date date,p_expiry_date date,p_program text,p_award text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
 declare o public.organizations; v_id uuid=gen_random_uuid(); v_name text; v_salt uuid=gen_random_uuid(); v_digest text;begin
 select * into o from public.organizations where id=p_organization for share;
 if o.id is null or not public.organization_member(o.id) or o.issuer_status<>'authorized' then raise exception 'An authorized issuer and organization membership are required';end if;
 if p_recipient=auth.uid() then raise exception 'You cannot issue yourself a credential';end if;
 -- Only public recipients may be selected directly. Private recipients use the private request workflow.
 if not public.public_talent(p_recipient) and not exists(select 1 from public.qualification_requests r where r.organization_id=o.id and r.recipient_id=p_recipient and r.status='pending') then raise exception 'Ask the recipient to publish their passport or send a verification request';end if;
 select name into v_name from public.companies where id=o.company_id;
 v_digest=encode(sha256(convert_to(jsonb_build_array(v_salt::text,coalesce(p_evidence,''))::text,'UTF8')),'hex');
 insert into public.credentials(id,organization_id,authorization_id,recipient_id,issuer_name,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_digest)
 values(v_id,o.id,o.authorization_id,p_recipient,v_name,p_title,p_type,p_description,p_issue_date,p_expiry_date,coalesce(p_program,''),coalesce(p_award,''),v_digest);
 insert into public.credential_evidence(credential_id,evidence_url,digest_salt) values(v_id,coalesce(p_evidence,''),v_salt);
 insert into public.credential_preferences(credential_id) values(v_id);
 return v_id; end; $$;
create function public.respond_credential(p_credential uuid,p_acceptance text,p_public boolean,p_share_evidence boolean) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not exists(select 1 from public.credentials where id=p_credential and recipient_id=auth.uid()) then raise exception 'Only the recipient can respond';end if;
 if p_acceptance not in ('accepted','declined') then raise exception 'Accept or decline this credential';end if;
 update public.credential_preferences set acceptance=p_acceptance,is_public=(p_acceptance='accepted' and p_public),share_evidence=(p_acceptance='accepted' and p_share_evidence),updated_at=now() where credential_id=p_credential;
 end; $$;
create function public.revoke_credential(p_credential uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
 declare v_org uuid;begin
 select organization_id into v_org from public.credentials where id=p_credential;
 if not public.organization_member(v_org) then raise exception 'Organization membership required';end if;
 insert into public.credential_events(credential_id,actor_id,event_type,reason) values(p_credential,auth.uid(),'revoked',p_reason);
 end; $$;
create function public.request_qualification_verification(p_organization uuid,p_title text,p_description text,p_issue_date date,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if not exists(select 1 from public.organizations where id=p_organization and organization_type='university' and issuer_status='authorized') then raise exception 'Choose an authorized university';end if;
 if public.organization_member(p_organization) then raise exception 'Institution staff cannot request their own verification';end if;
 insert into public.qualification_requests(organization_id,recipient_id,recipient_name,title,description,issue_date,evidence_url) values(p_organization,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_title,p_description,p_issue_date,p_evidence) returning id into v_id;
 return v_id;end; $$;
create function public.review_qualification_request(p_request uuid,p_approve boolean,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.qualification_requests;v_id uuid;begin
 select * into r from public.qualification_requests where id=p_request for update;
 if r.id is null or not public.organization_member(r.organization_id) or r.recipient_id=auth.uid() then raise exception 'Institution reviewer permission required';end if;
 if not exists(select 1 from public.organizations where id=r.organization_id and issuer_status='authorized') then raise exception 'Issuer authorization required';end if;
 if r.status<>'pending' or length(trim(p_feedback)) not between 10 and 2000 then raise exception 'Review a pending request and provide feedback';end if;
 if p_approve then v_id=public.issue_credential(r.organization_id,r.recipient_id,r.title,'degree',r.description,r.issue_date,null,'','',r.evidence_url);end if;
 update public.qualification_requests set status=case when p_approve then 'approved' else 'rejected' end,feedback=p_feedback,reviewer_id=auth.uid(),credential_id=v_id,reviewed_at=now() where id=r.id;
 return v_id;end; $$;
-- Issued facts, private evidence and audit events cannot be rewritten, even by ordinary service-role writes.
create trigger credentials_immutable before update or delete on public.credentials for each row execute function public.freeze_approved_record();
create trigger credential_evidence_immutable before update or delete on public.credential_evidence for each row execute function public.freeze_approved_record();
create trigger credential_events_immutable before update or delete on public.credential_events for each row execute function public.freeze_approved_record();
create trigger issuer_authorizations_immutable before update or delete on public.issuer_authorizations for each row execute function public.freeze_approved_record();
revoke all on public.platform_administrators,public.organizations,public.issuer_authorizations,public.credentials,public.credential_evidence,public.credential_preferences,public.credential_events,public.qualification_requests from anon,authenticated;
grant select on public.organizations,public.credentials,public.credential_evidence,public.credential_preferences,public.credential_events to anon,authenticated;
grant select on public.platform_administrators,public.issuer_authorizations,public.qualification_requests to authenticated;
grant all on public.platform_administrators,public.organizations,public.issuer_authorizations,public.credentials,public.credential_evidence,public.credential_preferences,public.credential_events,public.qualification_requests to service_role;
revoke all on function public.register_organization(text,text,text,text,uuid),public.authorize_issuer(uuid,text,boolean,text,text,text),public.issue_credential(uuid,uuid,text,text,text,date,date,text,text,text),public.respond_credential(uuid,text,boolean,boolean),public.revoke_credential(uuid,text),public.request_qualification_verification(uuid,text,text,date,text),public.review_qualification_request(uuid,boolean,text) from public,anon;
grant execute on function public.register_organization(text,text,text,text,uuid),public.authorize_issuer(uuid,text,boolean,text,text,text),public.issue_credential(uuid,uuid,text,text,text,date,date,text,text,text),public.respond_credential(uuid,text,boolean,boolean),public.revoke_credential(uuid,text),public.request_qualification_verification(uuid,text,text,date,text),public.review_qualification_request(uuid,boolean,text) to authenticated;
commit;
