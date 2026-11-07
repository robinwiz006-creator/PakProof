\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000001','{"full_name":"Trust Representative"}'),
('e0000000-0000-4000-8000-000000000002','{"full_name":"Trust Recipient"}'),
('e0000000-0000-4000-8000-000000000003','{"full_name":"Trust Admin"}'),
('e0000000-0000-4000-8000-000000000004','{"full_name":"Unrelated User"}');
insert into public.platform_administrators(user_id) values('e0000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true where id=auth.uid();
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.register_organization('training','Trust Fixture','Synthetic training organization for isolated testing.','https://example.com') as org \gset
select set_config('test.trust_org',:'org',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select public.review_issuer_authorization(:'org','Synthetic evidence checked for training only.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['course'],null);
select authorization_id as approval from public.organizations where id=:'org' \gset
select set_config('test.trust_approval',:'approval',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','e0000000-0000-4000-8000-000000000002','Course fixture','course','A synthetic course completed for isolated trust testing.',current_date,null,'','','') as credential \gset
select set_config('test.trust_credential',:'credential',true);

select public.submit_organization_verification(:'org','An institutional description and representative authority statement.','Training director','https://example.com/PRIVATE-institutional-evidence','','') as request \gset
select set_config('test.verification_request',:'request',true);
do $$begin
 if (select trust_level from public.organizations where id=current_setting('test.trust_org')::uuid)<>'self_registered' then raise exception 'Automatic trust promotion';end if;
 begin update public.organizations set trust_level='trusted_assessment_partner';raise exception 'Member trust forgery';exception when insufficient_privilege then null;end;
 begin perform public.review_organization_verification(current_setting('test.trust_org')::uuid,current_setting('test.verification_request')::uuid,null,'approve','verified_organization','A member must never approve their own trust.',true,false);raise exception 'Member review bypass';exception when raise_exception then if sqlerrm='Member review bypass' then raise;end if;end;
 begin perform public.submit_organization_verification(current_setting('test.trust_org')::uuid,'A second request while the first is still pending.','Director','https://example.com/evidence','','');raise exception 'Duplicate pending request';exception when raise_exception then if sqlerrm='Duplicate pending request' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000004';
do $$begin
 if exists(select 1 from public.organization_verification_requests) or exists(select 1 from public.organization_verification_outcomes) then raise exception 'Private evidence leaked';end if;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
do $$begin
 begin perform public.review_organization_verification(current_setting('test.trust_org')::uuid,current_setting('test.verification_request')::uuid,null,'approve','trusted_assessment_partner','No assessment evidence is present for this institution.',true,true);raise exception 'Assessment review bypass';exception when raise_exception then if sqlerrm='Assessment review bypass' then raise;end if;end;
 begin perform public.review_organization_verification(current_setting('test.trust_org')::uuid,current_setting('test.verification_request')::uuid,null,'approve','verified_organization','Identity confirmation is mandatory for institutional trust.',false,false);raise exception 'Identity review bypass';exception when raise_exception then if sqlerrm='Identity review bypass' then raise;end if;end;
end$$;
select public.review_organization_verification(:'org',:'request',null,'approve','verified_organization','Private official identity and representative authority evidence reviewed.',true,false);
select trust_review_id as trust_review from public.organizations where id=:'org' \gset
select set_config('test.verification_review',:'trust_review',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.submit_organization_verification(:'org','Institutional identity and authority remain documented.','Director','https://example.com/PRIVATE-institution','Assessment rubric, assessor qualifications and appeals are documented.','https://example.com/PRIVATE-assessment') as request2 \gset
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select public.review_organization_verification(:'org',:'request2',:'trust_review','approve','trusted_assessment_partner','Private assessment standards and institutional evidence checked.',true,true);
select trust_review_id as partner_review from public.organizations where id=:'org' \gset
select public.review_organization_verification(:'org',null,:'partner_review','downgrade','verified_organization','Assessment review no longer supports partner-level trust.',false,false);
select trust_review_id as lower_review from public.organizations where id=:'org' \gset
select public.review_organization_verification(:'org',null,:'lower_review','suspend','self_registered','Institutional verification suspended pending an updated review.',false,false);
do $$begin
 if not exists(select 1 from public.organizations where id=current_setting('test.trust_org')::uuid and trust_level='self_registered' and trust_suspended and issuer_status='authorized' and allowed_credential_types=array['course'] and authorization_id=current_setting('test.trust_approval')::uuid) then raise exception 'Trust review changed issuance permissions';end if;
 begin perform public.review_organization_verification(current_setting('test.trust_org')::uuid,null,current_setting('test.verification_review')::uuid,'suspend','self_registered','A stale administrator decision must be rejected.',false,false);raise exception 'Stale review accepted';exception when raise_exception then if sqlerrm='Stale review accepted' then raise;end if;end;
 if (select count(*) from public.issuer_authorizations where trust_decision is not null)<>4 then raise exception 'Trust audit history missing';end if;
 begin update public.issuer_authorizations set review_note='Rewritten trust evidence is forbidden';raise exception 'Audit rewritten';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','e0000000-0000-4000-8000-000000000002','Still scoped course','course','Trust suspension does not silently alter explicit category rights.',current_date,null,'','','');
do $$begin
 if (select title from public.credentials where id=current_setting('test.trust_credential')::uuid)<>'Course fixture' then raise exception 'Historical credential changed';end if;
 if exists(select 1 from public.issuer_authorizations) then raise exception 'Administrator private reason leaked to member';end if;
end$$;

-- Pending identity edits invalidate stale evidence. Trust alone grants no category.
select public.register_organization('training','Unscoped identity fixture','A new synthetic organization with no category authorization.','https://example.com/unscoped') as unscoped \gset
select company_id as unscoped_company from public.organizations where id=:'unscoped' \gset
select public.submit_organization_verification(:'unscoped','A private institution and representative authority statement.','Director','https://example.com/unscoped-evidence','','') as stale_request \gset
update public.companies set description='A changed institutional description requiring a fresh evidence review.' where id=:'unscoped_company';
select set_config('test.unscoped_org',:'unscoped',true),set_config('test.stale_request',:'stale_request',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
do $$begin
 begin perform public.review_organization_verification(current_setting('test.unscoped_org')::uuid,current_setting('test.stale_request')::uuid,null,'approve','verified_organization','Changed institutional facts must not use stale evidence.',true,false);raise exception 'Stale identity approved';exception when raise_exception then if sqlerrm='Stale identity approved' then raise;end if;end;
end$$;
select public.review_organization_verification(:'unscoped',:'stale_request',null,'reject','self_registered','Reject stale evidence and request updated institutional information.',false,false);
select trust_review_id as rejected_review from public.organizations where id=:'unscoped' \gset
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.submit_organization_verification(:'unscoped','Updated institutional identity and representative authority statement.','Director','https://example.com/fresh-evidence','','') as fresh_request \gset
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select public.review_organization_verification(:'unscoped',:'fresh_request',:'rejected_review','approve','verified_organization','New institutional identity and representative evidence reviewed.',true,false);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.organizations where id=current_setting('test.unscoped_org')::uuid and trust_level='verified_organization' and issuer_status='pending' and allowed_credential_types='{}') then raise exception 'Trust inferred category authority';end if;
 begin perform public.issue_credential(current_setting('test.unscoped_org')::uuid,'e0000000-0000-4000-8000-000000000002','Unauthorized trusted course','course','Identity trust alone must not grant credential issuance.',current_date,null,'','','');raise exception 'Trust bypassed category authorization';exception when raise_exception then if sqlerrm='Trust bypassed category authorization' then raise;end if;end;
end$$;
reset role;
insert into public.platform_administrators(user_id) values('e0000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.review_organization_verification(current_setting('test.trust_org')::uuid,null,(select trust_review_id from public.organizations where id=current_setting('test.trust_org')::uuid),'suspend','self_registered','An administrator member must not review their own organization.',true,true);raise exception 'Self-review bypass';exception when raise_exception then if sqlerrm='Self-review bypass' then raise;end if;end;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 begin perform 1 from public.organization_verification_requests;raise exception 'Public private-evidence access';exception when insufficient_privilege then null;end;
 if not exists(select 1 from public.organizations where id=current_setting('test.trust_org')::uuid and trust_level='self_registered' and trust_suspended) then raise exception 'Public current trust missing';end if;
end$$;
rollback;
\echo 'PASS: independent institutional trust, private evidence, assessment review, immutable audit, downgrade/suspension, category independence and historical records'
