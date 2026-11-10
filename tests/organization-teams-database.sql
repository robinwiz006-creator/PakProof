\set ON_ERROR_STOP on
begin;
do $$begin
 if position('not public.is_company_member(p.company_id)' in pg_get_functiondef('public.change_paid_lifecycle(uuid,text,text)'::regprocedure))=0 then raise exception 'Worker/company conflict check changed';end if;
end$$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select ('26000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'team'||n||'@example.test',case when n=5 then null else now() end,jsonb_build_object('full_name','Team fixture '||n) from generate_series(1,9)n;
insert into public.platform_administrators(user_id) values('26000000-0000-4000-8000-000000000009');
set local role authenticated;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
select public.create_company('Team Fixture','Synthetic organization used for role isolation testing.','https://example.test','') as company \gset
select public.register_organization('training','Team Fixture','Synthetic organization used for role isolation testing.','https://example.test',:'company') as org \gset
select set_config('test.teamcompany',:'company',true);select set_config('test.teamorg',:'org',true);
select public.prepare_team_invitation(:'company','team2@example.test','credential_manager',encode(sha256(convert_to(repeat('a',64),'UTF8')),'hex')) as invite \gset
select set_config('test.teaminvite',:'invite',true);
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000003';
do $$begin
 if exists(select 1 from public.organization_team_invitations) then raise exception 'Unrelated invitation leak';end if;
 if public.resolve_team_invitation(repeat('a',64)) is not null then raise exception 'Token bypassed email';end if;
 begin perform public.decide_team_invitation(current_setting('test.teaminvite')::uuid,'accepted');raise exception 'Wrong account accepted';exception when raise_exception then if sqlerrm='Wrong account accepted' then raise;end if;end;
 begin perform public.prepare_team_invitation(current_setting('test.teamcompany')::uuid,'team6@example.test','administrator',repeat('c',64));raise exception 'Unauthorized invited';exception when raise_exception then if sqlerrm='Unauthorized invited' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000002';
select public.decide_team_invitation(:'invite','accepted');
do $$begin
 if not public.credential_staff(current_setting('test.teamorg')::uuid) or public.opportunity_staff(current_setting('test.teamcompany')::uuid) or public.company_capability(current_setting('test.teamcompany')::uuid,'team') then raise exception 'Credential manager capabilities wrong';end if;
 begin perform public.decide_team_invitation(current_setting('test.teaminvite')::uuid,'accepted');raise exception 'Accepted twice';exception when raise_exception then if sqlerrm='Accepted twice' then raise;end if;end;
 begin perform token_hash from public.organization_team_invitations;raise exception 'Token hash leaked';exception when insufficient_privilege then null;end;
 begin update public.company_memberships set role='owner' where user_id=auth.uid();raise exception 'Raw escalation';exception when insufficient_privilege then null;end;
 begin perform public.create_challenge_with_rubric(jsonb_build_object('company_id',current_setting('test.teamcompany'),'title','Unauthorized challenge','description','A credential manager cannot create company challenges.','skills',jsonb_build_array('SQL'),'difficulty','Beginner','deadline',current_date+10,'deliverables','Provide evidence and source.'),'[]');raise exception 'Credential manager created challenge';exception when raise_exception then if sqlerrm='Credential manager created challenge' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
select public.prepare_team_invitation(:'company','team3@example.test','administrator',repeat('b',64)) as admin_invite \gset
select public.prepare_team_invitation(:'company','team4@example.test','opportunity_manager',repeat('d',64)) as opp_invite \gset
select public.prepare_team_invitation(:'company','team5@example.test','submission_reviewer',repeat('e',64)) as unverified_invite \gset
select set_config('test.unverified_invite',:'unverified_invite',true);
select public.prepare_team_invitation(:'company','team6@example.test','submission_reviewer',repeat('f',64)) as review_invite \gset
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000003';select public.decide_team_invitation(:'admin_invite','accepted');
do $$begin
 begin perform public.prepare_team_invitation(current_setting('test.teamcompany')::uuid,'team7@example.test','administrator',repeat('1',64));raise exception 'Admin assigned admin';exception when raise_exception then if sqlerrm='Admin assigned admin' then raise;end if;end;
 begin perform public.manage_team_member(current_setting('test.teamcompany')::uuid,'26000000-0000-4000-8000-000000000001','remove');raise exception 'Admin removed owner';exception when raise_exception then if sqlerrm='Admin removed owner' then raise;end if;end;
 begin perform public.manage_team_member(current_setting('test.teamcompany')::uuid,'26000000-0000-4000-8000-000000000002','owner');raise exception 'Owner promotion';exception when raise_exception then if sqlerrm='Owner promotion' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000005';
do $$begin begin perform public.decide_team_invitation(current_setting('test.unverified_invite')::uuid,'accepted');raise exception 'Unverified accepted';exception when raise_exception then if sqlerrm='Unverified accepted' then raise;end if;end;end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000004';select public.decide_team_invitation(:'opp_invite','accepted');
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Authorized team challenge','description','An opportunity manager creates a challenge within scope.','skills',jsonb_build_array('SQL'),'difficulty','Beginner','deadline',current_date+10,'deliverables','Provide source and test evidence.'),'[{"title":"Correctness","description":"The submitted work meets its scope."}]') as challenge \gset
select set_config('test.teamchallenge',:'challenge',true);
do $$begin
 if public.credential_staff(current_setting('test.teamorg')::uuid) then raise exception 'Opportunity manager got credentials';end if;
 begin perform public.prepare_credential_invitation(current_setting('test.teamorg')::uuid,'team8@example.test',repeat('1',64),'Unauthorized credential','course','Opportunity managers cannot issue credential invitations.',current_date,null,'','','');raise exception 'Opportunity credential bypass';exception when raise_exception then if sqlerrm='Opportunity credential bypass' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000006';select public.decide_team_invitation(:'review_invite','accepted');
do $$begin
 if not public.review_staff(current_setting('test.teamcompany')::uuid) or public.opportunity_staff(current_setting('test.teamcompany')::uuid) or public.discovery_staff(current_setting('test.teamcompany')::uuid) then raise exception 'Reviewer permissions wrong';end if;
 begin perform public.search_passports(current_setting('test.teamcompany')::uuid);raise exception 'Reviewer discovered private directory';exception when raise_exception then if sqlerrm='Reviewer discovered private directory' then raise;end if;end;
 if (public.organization_team_workspace(current_setting('test.teamcompany')::uuid)->>'can_manage')::boolean or jsonb_array_length(public.organization_team_workspace(current_setting('test.teamcompany')::uuid)->'events')<>0 then raise exception 'Reviewer sees team audit';end if;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000008';
select public.submit_work(:'challenge','https://example.test/work','','Synthetic work to assess reviewer access and permissions.') as submission \gset
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000006';
select id as rubric from public.challenge_rubrics where challenge_id=:'challenge' \gset
select public.review_assessed_submission(:'submission','approved','The authorized scoped reviewer checked the work.','["met"]',:'rubric');
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000009';
select public.review_issuer_authorization(:'org','Independent review grants only synthetic training categories.',true,'Team Fixture','Synthetic organization used for role isolation testing.','https://example.test',array['course'],null);
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000008';update public.profiles set is_public=true where id=auth.uid();
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000002';
select public.issue_credential(:'org','26000000-0000-4000-8000-000000000008','Scoped training credential','course','An authorized credential manager records this credential.',current_date,null,'','','');
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
select public.manage_team_member(:'company','26000000-0000-4000-8000-000000000002','remove');
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000002';
do $$begin
 if public.is_company_member(current_setting('test.teamcompany')::uuid) or public.credential_staff(current_setting('test.teamorg')::uuid) then raise exception 'Removed member retained access';end if;
 begin perform public.organization_team_workspace(current_setting('test.teamcompany')::uuid);raise exception 'Removed team access';exception when raise_exception then if sqlerrm='Removed team access' then raise;end if;end;
end$$;
reset role;
do $$begin begin delete from public.company_memberships where company_id=current_setting('test.teamcompany')::uuid and role='owner';raise exception 'Last owner deleted';exception when raise_exception then if sqlerrm='Last owner deleted' then raise;end if;end;end$$;
set local role authenticated;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
select public.prepare_team_invitation(:'company','team7@example.test','submission_reviewer',repeat('7',64)) as cancelled \gset
select public.decide_team_invitation(:'cancelled','cancelled');
select set_config('test.teamcancelled',:'cancelled',true);
select public.prepare_team_invitation(:'company','team7@example.test','submission_reviewer',repeat('8',64)) as expired \gset
select set_config('test.teamexpired',:'expired',true);
reset role;
update public.organization_team_invitations set expires_at=now()-interval '1 second' where id=:'expired';
set local role authenticated;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000007';
do $$begin
 begin perform public.decide_team_invitation(current_setting('test.teamcancelled')::uuid,'accepted');raise exception 'Cancelled accepted';exception when raise_exception then if sqlerrm='Cancelled accepted' then raise;end if;end;
 begin perform public.decide_team_invitation(current_setting('test.teamexpired')::uuid,'accepted');raise exception 'Expired accepted';exception when raise_exception then if sqlerrm='Expired accepted' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.organization_team_events where event_type='member_removed') then raise exception 'Audit absent';end if;
 begin delete from public.organization_team_events;raise exception 'Audit deletion';exception when insufficient_privilege then null;end;
 begin update public.organization_team_events set event_type='forged';raise exception 'Audit rewritten';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000003';
select public.prepare_team_invitation(:'company','team7@example.test','submission_reviewer',repeat('9',64)) as stale \gset
select set_config('test.teamstale',:'stale',true);
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000001';
select public.manage_team_member(:'company','26000000-0000-4000-8000-000000000003','opportunity_manager');
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000007';
do $$begin begin perform public.decide_team_invitation(current_setting('test.teamstale')::uuid,'accepted');raise exception 'Stale inviter accepted';exception when raise_exception then if sqlerrm='Stale inviter accepted' then raise;end if;end;end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000004';
select public.create_company('Second Team Fixture','Synthetic second team for organization switching.','https://example.test','') as second_company \gset
select set_config('test.secondteam',:'second_company',true);
do $$begin
 if public.organization_team_workspace(current_setting('test.teamcompany')::uuid)->>'role'<>'opportunity_manager' or public.organization_team_workspace(current_setting('test.secondteam')::uuid)->>'role'<>'owner' then raise exception 'Organization context mixed';end if;
end$$;
set local request.jwt.claim.sub='26000000-0000-4000-8000-000000000006';
do $$begin begin perform public.organization_team_workspace(current_setting('test.secondteam')::uuid);raise exception 'Other team leaked';exception when raise_exception then if sqlerrm='Other team leaked' then raise;end if;end;end$$;
rollback;
