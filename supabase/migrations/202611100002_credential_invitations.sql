begin;
create table public.credential_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 representative_id uuid not null references auth.users(id),
 authorization_id uuid not null references public.issuer_authorizations(id),
 recipient_email text not null check(length(recipient_email)<=254 and recipient_email=lower(trim(recipient_email)) and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 credential_id uuid not null unique default gen_random_uuid(),
 title text not null check(length(trim(title)) between 3 and 160),
 credential_type text not null check(credential_type in ('degree','course','workshop','bootcamp','hackathon_participation','hackathon_achievement','certification','company_achievement')),
 description text not null check(length(trim(description)) between 20 and 4000),
 issue_date date not null, expiry_date date check(expiry_date is null or expiry_date>=issue_date),
 program_name text not null default '' check(length(program_name)<=200),
 award text not null default '' check(length(award)<=200),
 evidence_url text not null default '' check(evidence_url='' or evidence_url ~ '^https?://'),
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '14 days'), responded_at timestamptz
);
create index credential_invitation_email on public.credential_invitations(recipient_email,status,expires_at);
create index credential_invitation_org on public.credential_invitations(organization_id,created_at desc);
create function public.invitation_recipient(p_email text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and lower(email)=p_email);
$$;
alter table public.credential_invitations enable row level security;
create policy invitation_read on public.credential_invitations for select to authenticated using(public.organization_member(organization_id) or public.invitation_recipient(recipient_email));
revoke all on public.credential_invitations from public,anon,authenticated,service_role;
grant select(id,organization_id,recipient_email,credential_id,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_url,status,created_at,expires_at,responded_at) on public.credential_invitations to authenticated;
create function public.prepare_credential_invitation(p_organization uuid,p_email text,p_token_hash text,p_title text,p_type text,p_description text,p_issue_date date,p_expiry_date date,p_program text,p_award text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
 declare o public.organizations; v_id uuid; begin
 select * into o from public.organizations where id=p_organization for share;
 if (p_type='degree' and o.organization_type<>'university') or not public.organization_member(o.id) or o.issuer_status is distinct from 'authorized' or not coalesce(p_type=any(o.allowed_credential_types),false) then raise exception 'Issuer category approval required';end if;
 if not exists(select 1 from public.issuer_authorizations where id=o.authorization_id and resulting_status='authorized' and p_type=any(allowed_credential_types)) then raise exception 'Current category approval required';end if;
 -- Serialize per organization to enforce limits even under concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(o.id::text,23));
 if (select count(*) from public.credential_invitations where organization_id=o.id and created_at>now()-interval '1 day')>=50 then raise exception 'Daily invitation limit reached';end if;
 if exists(select 1 from public.credential_invitations where organization_id=o.id and recipient_email=lower(trim(p_email)) and title=p_title and credential_type=p_type and status='pending' and expires_at>now()) then raise exception 'A pending invitation already exists';end if;
 insert into public.credential_invitations(organization_id,representative_id,authorization_id,recipient_email,token_hash,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_url)
 values(o.id,auth.uid(),o.authorization_id,lower(trim(p_email)),p_token_hash,p_title,p_type,p_description,p_issue_date,p_expiry_date,p_program,p_award,p_evidence) returning id into v_id;
 return v_id;end;$$;
create function public.resolve_credential_invitation(p_token text) returns uuid language sql stable security definer set search_path='' as $$
 select id from public.credential_invitations where length(p_token)=64 and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and public.invitation_recipient(recipient_email);
$$;
create function public.organization_member_for_invitation(p_user uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organizations o join public.company_memberships m on m.company_id=o.company_id where o.id=p_org and m.user_id=p_user);
$$;
create function public.decide_credential_invitation(p_invitation uuid,p_decision text) returns uuid language plpgsql security definer set search_path='' as $$
 declare i public.credential_invitations;o public.organizations;v_salt uuid=gen_random_uuid();v_digest text; begin
 select * into i from public.credential_invitations where id=p_invitation for update;
 if i.id is null then raise exception 'Invitation unavailable';end if;
 if p_decision='cancelled' then
  if not public.organization_member(i.organization_id) then raise exception 'Organization membership required';end if;
 else
  if p_decision not in ('accepted','declined') or p_decision is null or not public.invitation_recipient(i.recipient_email) then raise exception 'Use the intended verified email account';end if;
 end if;
 if i.status<>'pending' or i.expires_at<=now() then raise exception 'Invitation no longer pending';end if;
 if p_decision='accepted' then
  select * into o from public.organizations where id=i.organization_id for share;
  if not public.organization_member_for_invitation(i.representative_id,i.organization_id) or i.representative_id=auth.uid() then raise exception 'Issuing representative no longer eligible';end if;
  v_digest=encode(sha256(convert_to(jsonb_build_array(v_salt::text,i.evidence_url)::text,'UTF8')),'hex');
  insert into public.credentials(id,organization_id,authorization_id,recipient_id,issuer_name,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_digest)
  values(i.credential_id,o.id,o.authorization_id,auth.uid(),(select name from public.companies where id=o.company_id),i.title,i.credential_type,i.description,i.issue_date,i.expiry_date,i.program_name,i.award,v_digest);
  insert into public.credential_evidence(credential_id,evidence_url,digest_salt) values(i.credential_id,i.evidence_url,v_salt);
  insert into public.credential_preferences(credential_id,acceptance,is_public,share_evidence) values(i.credential_id,'accepted',false,false);
 end if;
 update public.credential_invitations set status=p_decision,responded_at=clock_timestamp() where id=i.id;
 return case when p_decision='accepted' then i.credential_id else null end;
 end;$$;
create or replace function public.audit_credential_issuance() returns trigger language plpgsql security definer set search_path='' as $$
 declare o public.organizations;a public.issuer_authorizations;v_rep uuid=auth.uid();begin
 select representative_id into v_rep from public.credential_invitations where credential_id=new.id and status='pending' and expires_at>now() and organization_id=new.organization_id and public.invitation_recipient(recipient_email) and new.recipient_id=auth.uid();
 if not found then v_rep=auth.uid();end if;
 select * into o from public.organizations where id=new.organization_id for share;
 select * into a from public.issuer_authorizations where id=o.authorization_id;
 if auth.uid() is null or not public.organization_member_for_invitation(v_rep,o.id) or new.recipient_id=v_rep
 or (new.credential_type='degree' and o.organization_type<>'university')
 or o.issuer_status is distinct from 'authorized' or not coalesce(new.credential_type=any(o.allowed_credential_types),false)
 or a.id is null or a.organization_id is distinct from o.id or a.resulting_status is distinct from 'authorized' or not coalesce(new.credential_type=any(a.allowed_credential_types),false)
 or new.authorization_id is distinct from o.authorization_id
 or new.issuer_name is distinct from (select name from public.companies where id=o.company_id)
 then raise exception 'This organization is not permitted to issue this credential type';end if;
 insert into public.credential_issuance_audit(credential_id,organization_id,representative_id,authorization_id,authorized_credential_type)
 values(new.id,new.organization_id,v_rep,o.authorization_id,new.credential_type);
 return new;
end;$$;
revoke all on function public.invitation_recipient(text),public.organization_member_for_invitation(uuid,uuid),public.prepare_credential_invitation(uuid,text,text,text,text,text,date,date,text,text,text),public.resolve_credential_invitation(text),public.decide_credential_invitation(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.invitation_recipient(text),public.prepare_credential_invitation(uuid,text,text,text,text,text,date,date,text,text,text),public.resolve_credential_invitation(text),public.decide_credential_invitation(uuid,text) to authenticated;
create view public.credential_invitation_inbox with(security_barrier=true) as
 select id,status,expires_at from public.credential_invitations where public.invitation_recipient(recipient_email);
revoke all on public.credential_invitation_inbox from public,anon,authenticated,service_role;
grant select on public.credential_invitation_inbox to authenticated;
notify pgrst,'reload schema';
commit;
