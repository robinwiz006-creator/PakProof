\set ON_ERROR_STOP on
begin;
do $$begin
 if encode(sha256(convert_to(jsonb_build_array('00000000-0000-4000-8000-000000000001','https://example.com/private-degree')::text,'UTF8')),'hex')<>'8c492cbfa8a41270214e3423cfbdbc3ed65834fcf0cdd168fe2a5a843824c575' then raise exception 'Credential evidence encoding mismatch';end if;
end$$;
insert into auth.users(id,raw_user_meta_data) values
('40000000-0000-4000-8000-000000000001','{"full_name":"Institution Representative"}'),
('50000000-0000-4000-8000-000000000001','{"full_name":"Graduate"}'),
('60000000-0000-4000-8000-000000000001','{"full_name":"Unrelated User"}'),
('70000000-0000-4000-8000-000000000001','{"full_name":"Administrator"}');
insert into public.platform_administrators(user_id) values('70000000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select public.register_organization('university','Fixture University','An isolated test university, not a real authorized institution.','https://example.com') as organization_id \gset
select set_config('test.organization_id',:'organization_id',true);
do $$begin
 begin perform public.authorize_issuer(current_setting('test.organization_id')::uuid,'I pretend that I am authorized to approve my organization.',true,'Fixture University','An isolated test university, not a real authorized institution.','https://example.com');raise exception 'Self authorization allowed';exception when raise_exception then if sqlerrm='Self authorization allowed' then raise;end if;end;
 begin update public.organizations set issuer_status='authorized';raise exception 'Direct trust forgery allowed';exception when insufficient_privilege then null;end;
 begin insert into public.platform_administrators(user_id) values(auth.uid());raise exception 'Admin escalation allowed';exception when insufficient_privilege then null;end;
 begin perform public.issue_credential(current_setting('test.organization_id')::uuid,'50000000-0000-4000-8000-000000000001','Test degree','degree','An attempted credential before issuer approval.',current_date,null,'','','');raise exception 'Unauthorized issuance allowed';exception when raise_exception then if sqlerrm='Unauthorized issuance allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.authorize_issuer(current_setting('test.organization_id')::uuid,'Fixture stale identity review must be rejected.',true,'Different University','An isolated test university, not a real authorized institution.','https://example.com');raise exception 'Stale identity authorization allowed';exception when raise_exception then if sqlerrm='Stale identity authorization allowed' then raise;end if;end;
end$$;
select public.authorize_issuer(:'organization_id','Fixture: official identity and representative authority checked in isolated tests only.',true,'Fixture University','An isolated test university, not a real authorized institution.','https://example.com');
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';
update public.profiles set is_public=true where id=auth.uid();
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
do $$begin
 begin update public.companies set name='Impersonated University' where id=(select company_id from public.organizations where id=current_setting('test.organization_id')::uuid);raise exception 'Authorized identity changed silently';exception when raise_exception then if sqlerrm='Authorized identity changed silently' then raise;end if;end;
end$$;
-- Match the app's published-slug lookup under the issuer's actual RLS role.
do $$begin
 if (select count(*) from public.profiles where slug='talent-50000000000040008000000000000001' and is_public)<>1 then raise exception 'Issuer cannot resolve published passport';end if;
 if exists(select 1 from public.profiles where slug='talent-70000000000040008000000000000001' and is_public) then raise exception 'Private administrator passport exposed';end if;
end$$;
select public.issue_credential(:'organization_id','50000000-0000-4000-8000-000000000001','Solana Hackathon Winner','hackathon_achievement','Recognition for a fixture event, not a real hackathon result.',current_date,null,'Fixture hackathon','First place','https://example.com/private-results') as credential_id \gset
select set_config('test.credential_id',:'credential_id',true);
set local request.jwt.claim.sub='60000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from public.credentials) or exists(select 1 from public.credential_evidence) then raise exception 'Pending credential leaked';end if;
 begin perform public.respond_credential(current_setting('test.credential_id')::uuid,'accepted',true,true);raise exception 'Other recipient consent allowed';exception when raise_exception then if sqlerrm='Other recipient consent allowed' then raise;end if;end;
 begin perform public.issue_credential(current_setting('test.organization_id')::uuid,auth.uid(),'Forged achievement','company_achievement','Forged achievement by unrelated organization member.',current_date,null,'','','');raise exception 'Unrelated issuance allowed';exception when raise_exception then if sqlerrm='Unrelated issuance allowed' then raise;end if;end;
 begin perform public.revoke_credential(current_setting('test.credential_id')::uuid,'Unrelated account tries revocation.');raise exception 'Unrelated revocation allowed';exception when raise_exception then if sqlerrm='Unrelated revocation allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';
do $$begin
 if (select count(*) from public.credentials)<>1 then raise exception 'Recipient cannot see pending record';end if;
 begin update public.credentials set title='Changed issuer fact';raise exception 'Recipient edited fact';exception when insufficient_privilege then null;end;
end$$;
do $$begin
 begin insert into public.credential_proofs(credential_id,signature,record_hash,issuer_wallet,anchored_at) values(current_setting('test.credential_id')::uuid,repeat('1',88),repeat('a',64),repeat('1',32),now());raise exception 'Client credential proof forgery allowed';exception when insufficient_privilege then null;end;
 begin perform public.record_credential_proof(current_setting('test.credential_id')::uuid,repeat('1',88),repeat('a',64),repeat('1',32),now());raise exception 'Client bypassed proof verifier';exception when insufficient_privilege then null;end;
end$$;
select public.respond_credential(:'credential_id','accepted',true,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 if (select count(*) from public.credentials)<>1 then raise exception 'Published credential not visible';end if;
 if exists(select 1 from public.credential_evidence) then raise exception 'Private credential evidence leaked';end if;
 begin perform 1 from public.qualification_requests;raise exception 'Anonymous request access granted';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';
select public.respond_credential(:'credential_id','accepted',true,true);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if (select count(*) from public.credential_evidence)<>1 then raise exception 'Explicit public evidence missing';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';
update public.profiles set is_public=false where id=auth.uid();
select public.request_qualification_verification(:'organization_id','BSc Computer Science','Please confirm this qualification against the institution records.',current_date,'https://example.com/private-degree') as request_id \gset
select set_config('test.request_id',:'request_id',true);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if exists(select 1 from public.credentials) or exists(select 1 from public.credential_evidence) then raise exception 'Private passport leaked';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
select public.review_qualification_request(:'request_id',true,'Institution records were checked in this fixture.') as degree_id \gset
select public.revoke_credential(:'credential_id','The fixture event result was corrected; historical facts remain unchanged.');
do $$begin
 if (select title from public.credentials where id=current_setting('test.credential_id')::uuid)<>'Solana Hackathon Winner' then raise exception 'Revocation changed original claim';end if;
 if (select count(*) from public.credential_events)<>1 then raise exception 'Revocation event missing';end if;
 begin perform public.review_qualification_request(current_setting('test.request_id')::uuid,true,'Duplicate approval must not create another degree.');raise exception 'Duplicate degree approval allowed';exception when raise_exception then if sqlerrm='Duplicate degree approval allowed' then raise;end if;end;
end$$;
reset role;
do $$begin
 begin update public.credentials set title='Privileged rewrite';raise exception 'Frozen facts could be rewritten';exception when raise_exception then if sqlerrm='Frozen facts could be rewritten' then raise;end if;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000001';
-- A public administrator passport remains discoverable by a separate issuer.
update public.profiles set is_public=true where id=auth.uid();
-- Admin access does not imply membership in the organization workspace.
do $$begin
 if exists(select 1 from public.organizations o where o.company_id in (select company_id from public.company_memberships where user_id=auth.uid())) then raise exception 'Admin unexpectedly became organization member';end if;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 if not exists(select 1 from public.profiles where slug='talent-70000000000040008000000000000001' and is_public) then raise exception 'Published administrator passport not public';end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
do $$declare recipient uuid;begin
 select id into recipient from public.profiles where slug='talent-70000000000040008000000000000001' and is_public;
 if recipient is null then raise exception 'Issuer cannot resolve administrator passport';end if;
 perform public.issue_credential(current_setting('test.organization_id')::uuid,recipient,'Administrator recipient test','company_achievement','An isolated test of issuing to a public administrator passport.',current_date,null,'','','');
end$$;
set local request.jwt.claim.sub='70000000-0000-4000-8000-000000000001';
select public.authorize_issuer(:'organization_id','Fixture: authorization suspended for investigation.',false,'Fixture University','An isolated test university, not a real authorized institution.','https://example.com');
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.issue_credential(current_setting('test.organization_id')::uuid,'50000000-0000-4000-8000-000000000001','Suspended credential','degree','A suspended institution must not issue another credential.',current_date,null,'','','');raise exception 'Suspended issuance allowed';exception when raise_exception then if sqlerrm='Suspended issuance allowed' then raise;end if;end;
end$$;
rollback;
\echo 'PASS: organization trust, issuance, acceptance, evidence privacy, revocation, requests, immutable facts, and unauthorized attempts'
