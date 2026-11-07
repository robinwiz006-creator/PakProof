\set ON_ERROR_STOP on
-- Disposable local fixture, deliberately seeded BEFORE the privacy migration.
insert into auth.users(id,raw_user_meta_data) values
('d9000000-0000-4000-8000-000000000001','{"full_name":"Fixture Issuer"}'),
('d9000000-0000-4000-8000-000000000002','{"full_name":"Fixture Recipient"}'),
('d9000000-0000-4000-8000-000000000003','{"full_name":"Fixture Outsider"}'),
('d9000000-0000-4000-8000-000000000004','{"full_name":"Fixture Administrator"}');
insert into public.platform_administrators(user_id) values('d9000000-0000-4000-8000-000000000004');
set role authenticated;
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000001';
select public.register_organization('company','Revocation Fixture','Isolated organization for credential event privacy regression.','https://example.com') as org \gset
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000004';
select public.review_issuer_authorization(:'org','PRIVATE review fixture: not a public investigation note.',true,'Revocation Fixture','Isolated organization for credential event privacy regression.','https://example.com',array['company_achievement'],null);
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true where id=auth.uid();
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','d9000000-0000-4000-8000-000000000002','Historical fixture achievement','company_achievement','An isolated achievement record used only to test privacy.',current_date,null,'','','https://example.com/private-evidence') as credential \gset
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
set request.jwt.claim.sub='d9000000-0000-4000-8000-000000000001';
select public.revoke_credential(:'credential','Public fixture explanation: the issued record was corrected.');
reset role;
create schema revocation_fixture;
create function revocation_fixture.fingerprint() returns text language sql as $$
 select md5(jsonb_build_array(
 (select jsonb_agg(to_jsonb(t) order by id) from public.credentials t),
 (select jsonb_agg(to_jsonb(t) order by id) from public.credential_events t),
 (select jsonb_agg(to_jsonb(t) order by credential_id) from public.credential_proofs t),
 (select jsonb_agg(to_jsonb(t)-array['previous_trust_review_id','trust_decision','previous_trust_level','resulting_trust_level','resulting_trust_suspended','verification_request_id'] order by id) from public.issuer_authorizations t),
 (select jsonb_agg(to_jsonb(t) order by credential_id) from public.credential_issuance_audit t))::text)
$$;
create table revocation_fixture.before_snapshot as select revocation_fixture.fingerprint() as digest;
-- Demonstrate the old leak without printing attribution or public record values.
set role anon;
set request.jwt.claim.sub='';
do $$begin
 if not exists(select 1 from public.credential_events where actor_id='d9000000-0000-4000-8000-000000000001') then raise exception 'Pre-migration reproduction missing';end if;
end$$;
reset role;
