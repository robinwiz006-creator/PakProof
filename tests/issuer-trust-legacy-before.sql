-- Synthetic pre-upgrade credential/proof; no real transaction is claimed.
insert into auth.users(id,raw_user_meta_data) values
('f0000000-0000-4000-8000-000000000001','{"full_name":"Legacy Representative"}'),
('f0000000-0000-4000-8000-000000000002','{"full_name":"Legacy Recipient"}'),
('f0000000-0000-4000-8000-000000000003','{"full_name":"Legacy Admin"}');
insert into public.platform_administrators(user_id) values('f0000000-0000-4000-8000-000000000003');
set role authenticated;
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true where id=auth.uid();
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select public.register_organization('training','Legacy Fixture','Synthetic legacy institution for upgrade testing.','https://example.com') as org \gset
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000003';
select public.authorize_issuer(:'org','Synthetic historical approval; categories were not recorded.',true,'Legacy Fixture','Synthetic legacy institution for upgrade testing.','https://example.com');
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','f0000000-0000-4000-8000-000000000002','Legacy course','course','A synthetic historical course credential for compatibility testing.',current_date,null,'','','') as credential \gset
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
reset role;
insert into public.credential_proofs(credential_id,signature,record_hash,issuer_wallet,anchored_at) values(:'credential',repeat('1',88),repeat('a',64),repeat('1',32),now());
create table public.test_issuer_baseline as select
 (select to_jsonb(c) from public.credentials c where id=:'credential') as credential,
 (select to_jsonb(a) from public.issuer_authorizations a where organization_id=:'org') as authorization_snapshot,
 (select to_jsonb(p) from public.credential_proofs p where credential_id=:'credential') as proof;
