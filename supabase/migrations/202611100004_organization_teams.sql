begin;
alter table public.company_memberships drop constraint company_memberships_role_check;
alter table public.company_memberships add constraint company_memberships_role_check check(role in ('owner','reviewer','administrator','credential_manager','opportunity_manager','submission_reviewer'));
create function public.company_user_capability(p_company uuid,p_capability text,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_memberships m where m.company_id=p_company and m.user_id=p_user and (
 m.role='owner' or (m.role='administrator' and p_capability in ('team','settings','credentials','opportunities','review','discovery'))
 or (m.role='reviewer' and p_capability in ('settings','credentials','opportunities','review','discovery'))
 or (m.role='credential_manager' and p_capability='credentials')
 or (m.role='opportunity_manager' and p_capability in ('opportunities','review','discovery'))
 or (m.role='submission_reviewer' and p_capability='review')));
$$;
create function public.company_capability(p_company uuid,p_capability text) returns boolean language sql stable security definer set search_path='' as $$ select public.company_user_capability(p_company,p_capability,auth.uid());$$;
create function public.credential_staff(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organizations where id=p_org and public.company_capability(company_id,'credentials'));$$;
create function public.organization_settings_staff(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organizations where id=p_org and public.company_capability(company_id,'settings'));$$;
create function public.opportunity_staff(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$select public.company_capability(p_company,'opportunities');$$;
create function public.review_staff(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$select public.company_capability(p_company,'review');$$;
create function public.discovery_staff(p_company uuid) returns boolean language sql stable security definer set search_path='' as $$select public.company_capability(p_company,'discovery');$$;
create or replace function public.organization_member_for_invitation(p_user uuid,p_org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organizations where id=p_org and public.company_user_capability(company_id,'credentials',p_user));$$;
do $$declare r record;definition text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['visible_credential','issue_credential','revoke_credential','review_qualification_request','issue_challenge_credential','protect_credential_correction','correct_credential','prepare_credential_invitation','decide_credential_invitation','approved_work_credential_context']) loop
 definition=pg_get_functiondef(r.oid);
 definition=replace(definition,'public.organization_member(','public.credential_staff(');
 execute definition;
 end loop;
end$$;
do $$declare r record;definition text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['submit_organization_verification']) loop
 definition=pg_get_functiondef(r.oid);
 definition=replace(definition,'public.organization_member(','public.organization_settings_staff(');
 execute definition;
 end loop;
end$$;
do $$declare r record;definition text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['can_review_profile','paid_project_party','create_paid_project','publish_paid_project','select_paid_worker','review_paid_milestone','consent_paid_work','edit_paid_project','set_challenge_rubric','create_challenge_with_rubric']) loop
 definition=pg_get_functiondef(r.oid);
 definition=replace(definition,'public.is_company_member(','public.opportunity_staff(');
 execute definition;
 end loop;
end$$;
do $$declare r record;definition text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['reviews_submission','review_submission','review_assessed_submission','review_assessed_submission_details']) loop
 definition=pg_get_functiondef(r.oid);
 definition=replace(definition,'public.is_company_member(','public.review_staff(');
 execute definition;
 end loop;
end$$;
do $$declare r record;definition text;begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['save_candidate','remove_saved_candidate','create_contact_request','send_contact_followup','close_contact_request','contact_request_opportunity','save_candidate_for_opportunity','invite_candidate_to_opportunity','search_passports_evidence']) loop
 definition=pg_get_functiondef(r.oid);
 definition=replace(definition,'public.is_company_member(','public.discovery_staff(');
 execute definition;
 end loop;
end$$;
do $$declare r record;u text;c text;cap text;begin
 for r in select n.nspname,t.relname,p.polname,pg_get_expr(p.polqual,p.polrelid) as qual,pg_get_expr(p.polwithcheck,p.polrelid) as chk
 from pg_policy p join pg_class t on t.oid=p.polrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' loop
 cap=case when r.relname in ('credentials','credential_events','challenge_credential_sources','credential_evidence','credential_preferences','qualification_requests','credential_issuance_audit','credential_corrections','credential_invitations') then 'credentials'
 when r.relname in ('organization_verification_requests') then 'settings'
 when r.relname in ('employer_shortlists','contact_requests','contact_followups') then 'discovery'
 when r.relname in ('challenges','paid_projects','paid_milestones','paid_project_applications','paid_project_offers') then 'opportunities' else null end;
 if cap is null then continue;end if;
 u=r.qual;c=r.chk;
 if cap='credentials' then u=replace(u,'organization_member(','credential_staff(');c=replace(c,'organization_member(','credential_staff(');
 elsif cap='settings' then u=replace(u,'organization_member(','organization_settings_staff(');c=replace(c,'organization_member(','organization_settings_staff(');
 else u=replace(u,'is_company_member(',case when cap='discovery' then 'discovery_staff(' else 'opportunity_staff(' end);c=replace(c,'is_company_member(',case when cap='discovery' then 'discovery_staff(' else 'opportunity_staff(' end);end if;
 if u is distinct from r.qual or c is distinct from r.chk then execute format('alter policy %I on public.%I %s %s',r.polname,r.relname,case when u is null then '' else 'using ('||u||')' end,case when c is null then '' else 'with check ('||c||')' end);end if;
 end loop;
 for r in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v' and c.relname in ('visible_contact_requests','visible_contact_followups','credential_correction_status') loop
 u=pg_get_viewdef(r.oid,true);u=replace(u,'is_company_member(','discovery_staff(');u=replace(u,'organization_member(','credential_staff(');
 execute format('create or replace view public.%I with(security_barrier=true,security_invoker=false) as %s',r.relname,u);
 end loop;
end$$;
-- Reviewers need challenge context for authorized submissions, not arbitrary
-- private Passports/projects. can_review_profile remains opportunity-scoped.
alter policy challenges_read on public.challenges using(status='published' or public.opportunity_staff(company_id) or exists(select 1 from public.challenge_submissions s where s.challenge_id=challenges.id and (s.talent_id=auth.uid() or public.review_staff(challenges.company_id))));
-- Owners remain the only paying role. Issuer wallets require actual credential capability.
do $$declare definition text;begin
 select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='record_wallet_connection';
 definition=replace(definition,$old$(c.purpose<>'credential_issuer' or o.issuer_status='authorized')$old$,$new$(c.purpose<>'credential_issuer' or (o.issuer_status='authorized' and public.company_user_capability(o.company_id,'credentials',p_user)))$new$);execute definition;
end$$;
create table public.organization_team_events (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),actor_id uuid references auth.users(id),event_type text not null,subject_id uuid,details jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index team_events_scope on public.organization_team_events(company_id,created_at desc);
alter table public.organization_team_events enable row level security;
create policy team_events_read on public.organization_team_events for select to authenticated using(public.company_capability(company_id,'team'));
revoke all on public.organization_team_events from public,anon,authenticated,service_role;
grant select on public.organization_team_events to authenticated;
create trigger team_audit_immutable before update or delete on public.organization_team_events for each row execute function public.freeze_approved_record();
create table public.organization_team_invitations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),created_by uuid not null references auth.users(id),recipient_email text not null check(recipient_email=lower(trim(recipient_email)) and length(recipient_email)<=254 and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),proposed_role text not null check(proposed_role in ('administrator','credential_manager','opportunity_manager','submission_reviewer')),token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '7 days'),responded_at timestamptz
);
create index team_invite_scope on public.organization_team_invitations(company_id,created_at desc);
create index team_invite_recipient on public.organization_team_invitations(recipient_email,status,expires_at);
alter table public.organization_team_invitations enable row level security;
create policy team_invitation_read on public.organization_team_invitations for select to authenticated using(public.company_capability(company_id,'team') or public.invitation_recipient(recipient_email));
revoke all on public.organization_team_invitations from public,anon,authenticated,service_role;
grant select(id,company_id,recipient_email,proposed_role,status,created_at,expires_at,responded_at) on public.organization_team_invitations to authenticated;
create function public.can_assign_user_team_role(p_company uuid,p_role text,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.company_memberships where company_id=p_company and user_id=p_actor and (role='owner' or (role='administrator' and p_role in ('credential_manager','opportunity_manager','submission_reviewer')))) and p_role in ('administrator','credential_manager','opportunity_manager','submission_reviewer');
$$;
create function public.can_assign_team_role(p_company uuid,p_role text) returns boolean language sql stable security definer set search_path='' as $$select public.can_assign_user_team_role(p_company,p_role,auth.uid());$$;
create function public.guard_team_membership() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op<>'INSERT' then
 perform 1 from public.companies where id=old.company_id for update;
 if (tg_op='DELETE' or new.role<>'owner') and old.role='owner' and (select count(*) from public.company_memberships where company_id=old.company_id and role='owner')<=1 then raise exception 'The last owner must remain. Ownership transfer is not supported';end if;
 end if;
 if tg_op='UPDATE' and (new.company_id<>old.company_id or new.user_id<>old.user_id) then raise exception 'Membership identity is immutable';end if;
 return case when tg_op='DELETE' then old else new end;
end;$$;
create trigger membership_guard before update or delete on public.company_memberships for each row execute function public.guard_team_membership();
create function public.audit_team_membership() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.organization_team_events(company_id,actor_id,event_type,subject_id,details) values(case when tg_op='DELETE' then old.company_id else new.company_id end,auth.uid(),case tg_op when 'INSERT' then 'member_added' when 'UPDATE' then 'role_changed' else 'member_removed' end,case when tg_op='DELETE' then old.user_id else new.user_id end,jsonb_build_object('previous_role',case when tg_op='INSERT' then null else old.role end,'resulting_role',case when tg_op='DELETE' then null else new.role end));
 return case when tg_op='DELETE' then old else new end;
end;$$;
create trigger membership_audit after insert or update or delete on public.company_memberships for each row execute function public.audit_team_membership();
create function public.prepare_team_invitation(p_company uuid,p_email text,p_role text,p_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$declare v uuid;begin
 if not public.can_assign_team_role(p_company,p_role) then raise exception 'You cannot invite this role';end if;
 perform 1 from public.companies where id=p_company for update;
 if exists(select 1 from public.organization_team_invitations where company_id=p_company and recipient_email=lower(trim(p_email)) and status='pending' and expires_at>now()) then raise exception 'A pending invitation already exists';end if;
 if (select count(*) from public.organization_team_invitations where company_id=p_company and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit reached';end if;
 insert into public.organization_team_invitations(company_id,created_by,recipient_email,proposed_role,token_hash) values(p_company,auth.uid(),lower(trim(p_email)),p_role,p_token_hash) returning id into v;
 insert into public.organization_team_events(company_id,actor_id,event_type,subject_id,details) values(p_company,auth.uid(),'invitation_created',v,jsonb_build_object('role',p_role));return v;
end;$$;
create function public.resolve_team_invitation(p_token text) returns uuid language sql stable security definer set search_path='' as $$select id from public.organization_team_invitations where length(p_token)=64 and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and public.invitation_recipient(recipient_email);$$;
create function public.decide_team_invitation(p_invitation uuid,p_decision text) returns uuid language plpgsql security definer set search_path='' as $$declare i public.organization_team_invitations;c uuid;begin
 select company_id into c from public.organization_team_invitations where id=p_invitation;
 perform 1 from public.companies where id=c for update;
 select * into i from public.organization_team_invitations where id=p_invitation for update;
 if i.id is null or p_decision is null or p_decision not in ('accepted','declined','cancelled') then raise exception 'Invitation unavailable';end if;
 if p_decision='cancelled' then
 if not public.company_capability(i.company_id,'team') or (not public.is_company_owner(i.company_id) and i.proposed_role='administrator') then raise exception 'Team management permission required';end if;
 elsif not public.invitation_recipient(i.recipient_email) then raise exception 'Use the intended verified email account';end if;
 if i.status<>'pending' or i.expires_at<=now() then raise exception 'Invitation is no longer pending';end if;
 if p_decision='accepted' then
 if not public.can_assign_user_team_role(i.company_id,i.proposed_role,i.created_by) then raise exception 'The inviter no longer has permission. Request a new invitation';end if;
 if exists(select 1 from public.company_memberships where company_id=i.company_id and user_id=auth.uid()) then raise exception 'Already a member. Ask an authorized manager to change your role';end if;
 insert into public.company_memberships(company_id,user_id,role) values(i.company_id,auth.uid(),i.proposed_role);
 end if;
 update public.organization_team_invitations set status=p_decision,responded_at=clock_timestamp() where id=i.id;
 insert into public.organization_team_events(company_id,actor_id,event_type,subject_id,details) values(i.company_id,auth.uid(),'invitation_'||p_decision,i.id,jsonb_build_object('role',i.proposed_role));return i.company_id;
end;$$;
create function public.manage_team_member(p_company uuid,p_member uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$declare m public.company_memberships;v_cancel uuid;begin
 perform 1 from public.companies where id=p_company for update;
 select * into m from public.company_memberships where company_id=p_company and user_id=p_member for update;
 if m.user_id is null or not public.company_capability(p_company,'team') then raise exception 'Team management permission required';end if;
 if p_member=auth.uid() then raise exception 'Ask another owner to change your access; self-lockout is blocked';end if;
 if not public.is_company_owner(p_company) and m.role in ('owner','administrator','reviewer') then raise exception 'Only an owner can manage this member';end if;
 if m.role='owner' and exists(select 1 from public.payment_intents i join public.paid_milestones mi on mi.id=i.milestone_id join public.paid_projects p on p.id=mi.project_id where i.payer_user_id=p_member and p.company_id=p_company and i.status in ('prepared','signed','pending','needs_review')) then raise exception 'Reconcile outstanding owner payments before changing access';end if;
 if p_role='remove' then
 delete from public.company_memberships where company_id=p_company and user_id=p_member;
 else
 if not public.can_assign_team_role(p_company,p_role) then raise exception 'You cannot assign this role';end if;
 update public.company_memberships set role=p_role where company_id=p_company and user_id=p_member;
 end if;
 for v_cancel in update public.organization_team_invitations set status='cancelled',responded_at=clock_timestamp()
 where company_id=p_company and status='pending' and ((created_by=p_member and not public.can_assign_user_team_role(p_company,proposed_role,p_member)) or (p_role='remove' and recipient_email=(select lower(email) from auth.users where id=p_member))) returning id loop
 insert into public.organization_team_events(company_id,actor_id,event_type,subject_id,details) values(p_company,auth.uid(),'invitation_cancelled',v_cancel,jsonb_build_object('reason','membership_access_changed'));
 end loop;
end;$$;
create function public.organization_team_workspace(p_company uuid,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;manager boolean;begin
 if not public.is_company_member(p_company) then raise exception 'Organization membership required';end if;
 if p_page is null or p_page not between 1 and 10000 then raise exception 'Choose a valid page';end if;
 manager=public.company_capability(p_company,'team');
 select jsonb_build_object('role',(select role from public.company_memberships where company_id=p_company and user_id=auth.uid()),'can_manage',manager,'total',(select count(*) from public.company_memberships where company_id=p_company),'members',coalesce((select jsonb_agg(to_jsonb(x)) from (select case when manager then m.user_id else null end as user_id,p.full_name,m.role,m.created_at from public.company_memberships m join public.profiles p on p.id=m.user_id where m.company_id=p_company order by m.created_at,m.user_id limit 20 offset(p_page-1)*20)x),'[]'),'event_total',case when manager then (select count(*) from public.organization_team_events where company_id=p_company) else 0 end,'events',case when manager then coalesce((select jsonb_agg(to_jsonb(x)) from (select e.event_type,e.created_at,e.details,coalesce(p.full_name,'System/database operation') as actor from public.organization_team_events e left join public.profiles p on p.id=e.actor_id where e.company_id=p_company order by e.created_at desc,e.id limit 20 offset(p_page-1)*20)x),'[]') else '[]'::jsonb end) into result;
 return result;end;$$;
create view public.my_team_invitations with(security_barrier=true,security_invoker=false) as select id,company_id,proposed_role,case when status='pending' and expires_at<=now() then 'expired' else status end as status,expires_at from public.organization_team_invitations where public.invitation_recipient(recipient_email);
revoke all on public.my_team_invitations from public,anon,authenticated,service_role;
grant select on public.my_team_invitations to authenticated;
revoke all on function public.company_capability(uuid,text),public.credential_staff(uuid),public.organization_settings_staff(uuid),public.opportunity_staff(uuid),public.review_staff(uuid),public.discovery_staff(uuid),public.can_assign_team_role(uuid,text),public.guard_team_membership(),public.audit_team_membership(),public.prepare_team_invitation(uuid,text,text,text),public.resolve_team_invitation(text),public.decide_team_invitation(uuid,text),public.manage_team_member(uuid,uuid,text),public.organization_team_workspace(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.company_capability(uuid,text),public.credential_staff(uuid),public.organization_settings_staff(uuid),public.opportunity_staff(uuid),public.review_staff(uuid),public.discovery_staff(uuid),public.can_assign_team_role(uuid,text),public.prepare_team_invitation(uuid,text,text,text),public.resolve_team_invitation(text),public.decide_team_invitation(uuid,text),public.manage_team_member(uuid,uuid,text),public.organization_team_workspace(uuid,integer) to authenticated;
-- Public policies may use these predicates; they return false without an account.
grant execute on function public.credential_staff(uuid),public.opportunity_staff(uuid),public.review_staff(uuid),public.discovery_staff(uuid),public.company_capability(uuid,text) to anon;
revoke all on function public.company_user_capability(uuid,text,uuid),public.can_assign_user_team_role(uuid,text,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
