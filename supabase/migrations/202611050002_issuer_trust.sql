-- Forward-only: historical claims, authorization rows and proofs are not rewritten.
begin;
alter table public.organizations add column allowed_credential_types text[] not null default '{}'
 check(allowed_credential_types <@ array['degree','course','workshop','bootcamp','hackathon_participation','hackathon_achievement','certification','company_achievement']::text[]);
alter table public.issuer_authorizations
 add column decision text check(decision in ('approval','suspension','reinstatement','permissions_changed','review')),
 add column previous_status text,
 add column resulting_status text,
 add column previous_credential_types text[],
 add column allowed_credential_types text[];
-- NULL historical decision/category fields deliberately mean "not recorded".
create table public.credential_issuance_audit (
 credential_id uuid primary key references public.credentials(id),
 organization_id uuid not null references public.organizations(id),
 representative_id uuid not null references auth.users(id),
 authorization_id uuid not null references public.issuer_authorizations(id),
 authorized_credential_type text not null,
 issued_at timestamptz not null default clock_timestamp()
);
alter table public.credential_issuance_audit enable row level security;
create policy issuance_audit_read on public.credential_issuance_audit for select to authenticated
 using(public.is_platform_administrator() or public.organization_member(organization_id));
create trigger issuance_audit_immutable before update or delete on public.credential_issuance_audit
 for each row execute function public.freeze_approved_record();
revoke all on public.credential_issuance_audit from public,anon,authenticated,service_role;
grant select on public.credential_issuance_audit to authenticated,service_role;

create function public.review_issuer_authorization(p_organization uuid,p_note text,p_authorize boolean,p_name text,p_description text,p_website text,p_types text[],p_expected_authorization uuid)
returns void language plpgsql security definer set search_path='' as $$
 declare o public.organizations;c public.companies;v_id uuid;v_types text[];v_decision text;begin
 if not public.is_platform_administrator() then raise exception 'Administrator access required';end if;
 if public.organization_member(p_organization) then raise exception 'Administrators cannot authorize an organization they belong to';end if;
 select * into o from public.organizations where id=p_organization for update;
 if o.id is null then raise exception 'Organization not found';end if;
 if o.authorization_id is distinct from p_expected_authorization then raise exception 'Authorization changed since review. Reload before deciding';end if;
 select * into c from public.companies where id=o.company_id for update;
 if c.name is distinct from p_name or c.description is distinct from p_description or c.website is distinct from p_website then raise exception 'Organization identity changed since review. Reload and review again';end if;
 if p_authorize is null or p_types is null or array_position(p_types,null) is not null or not(p_types <@ array['degree','course','workshop','bootcamp','hackathon_participation','hackathon_achievement','certification','company_achievement']::text[]) then raise exception 'Choose supported credential permissions explicitly';end if;
 if length(trim(p_note)) not between 20 and 2000 or p_note is null then raise exception 'Record your review and evidence';end if;
 select coalesce(array_agg(t order by t),'{}') into v_types from (select distinct unnest(p_types) t) s;
 if not p_authorize then v_types='{}';end if;
 if 'degree'=any(v_types) and o.organization_type<>'university' then raise exception 'Degree permission requires a university organization and separate academic-authority review';end if;
 v_decision=case when not p_authorize then 'suspension' when o.issuer_status='suspended' then 'reinstatement' when o.issuer_status='pending' then 'approval' when o.allowed_credential_types is distinct from v_types then 'permissions_changed' else 'review' end;
 insert into public.issuer_authorizations(organization_id,administrator_id,identity_digest,review_note,decision,previous_status,resulting_status,previous_credential_types,allowed_credential_types)
 values(o.id,auth.uid(),encode(sha256(convert_to(jsonb_build_array(c.name,c.description,c.website)::text,'UTF8')),'hex'),p_note,v_decision,o.issuer_status,case when p_authorize then 'authorized' else 'suspended' end,o.allowed_credential_types,v_types) returning id into v_id;
 update public.organizations set issuer_status=case when p_authorize then 'authorized' else 'suspended' end,authorization_id=v_id,allowed_credential_types=v_types where id=o.id;
 end;$$;
-- Old clients cannot bypass scoped approval: their legacy call grants no types.
create or replace function public.authorize_issuer(p_organization uuid,p_note text,p_authorize boolean,p_name text,p_description text,p_website text)
returns void language plpgsql security definer set search_path='' as $$begin
 perform public.review_issuer_authorization(p_organization,p_note,p_authorize,p_name,p_description,p_website,'{}',(select authorization_id from public.organizations where id=p_organization));
end;$$;

-- The insert trigger covers issue_credential, qualification approvals, and direct
-- privileged inserts. Attribution is derived from auth.uid(), never client input.
create function public.audit_credential_issuance() returns trigger language plpgsql security definer set search_path='' as $$
 declare o public.organizations;a public.issuer_authorizations;begin
 select * into o from public.organizations where id=new.organization_id for share;
 select * into a from public.issuer_authorizations where id=o.authorization_id;
 if auth.uid() is null or not public.organization_member(o.id) or new.recipient_id=auth.uid()
 or (new.credential_type='degree' and o.organization_type<>'university')
 or o.issuer_status is distinct from 'authorized' or not coalesce(new.credential_type=any(o.allowed_credential_types),false)
 or a.id is null or a.organization_id is distinct from o.id or a.resulting_status is distinct from 'authorized' or not coalesce(new.credential_type=any(a.allowed_credential_types),false)
 or new.authorization_id is distinct from o.authorization_id
 or new.issuer_name is distinct from (select name from public.companies where id=o.company_id)
 then raise exception 'This organization is not permitted to issue this credential type';end if;
 insert into public.credential_issuance_audit(credential_id,organization_id,representative_id,authorization_id,authorized_credential_type)
 values(new.id,new.organization_id,auth.uid(),o.authorization_id,new.credential_type);
 return new;
end;$$;
create trigger credentials_issuance_audit after insert on public.credentials
 for each row execute function public.audit_credential_issuance();

-- A fixed, consent-filtered public projection reveals accountability coverage,
-- not staff IDs or the administrator's private notes. Old credentials have no row.
create view public.credential_issuance_provenance with(security_barrier=true,security_invoker=false) as
 select credential_id,authorization_id,authorized_credential_type,issued_at,
 true as representative_recorded
 from public.credential_issuance_audit where public.visible_credential(credential_id);
revoke all on public.credential_issuance_provenance from public,anon,authenticated,service_role;
grant select on public.credential_issuance_provenance to anon,authenticated,service_role;
revoke all on function public.review_issuer_authorization(uuid,text,boolean,text,text,text,text[],uuid),public.audit_credential_issuance() from public,anon,authenticated,service_role;
grant execute on function public.review_issuer_authorization(uuid,text,boolean,text,text,text,text[],uuid) to authenticated;
create or replace function public.request_qualification_verification(p_organization uuid,p_title text,p_description text,p_issue_date date,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
 declare v_id uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 if not exists(select 1 from public.organizations where id=p_organization and organization_type='university' and issuer_status='authorized' and 'degree'=any(allowed_credential_types)) then raise exception 'Choose an authorized university';end if;
 if public.organization_member(p_organization) then raise exception 'Institution staff cannot request their own verification';end if;
 insert into public.qualification_requests(organization_id,recipient_id,recipient_name,title,description,issue_date,evidence_url) values(p_organization,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_title,p_description,p_issue_date,p_evidence) returning id into v_id;
 return v_id;end; $$;

notify pgrst,'reload schema';
commit;
