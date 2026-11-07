-- Populated pre-handoff data in a separate disposable database.
insert into auth.users(id,raw_user_meta_data) select ('f3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('full_name','Legacy contact fixture '||n) from generate_series(1,4) n;
update public.profiles set is_public=true,is_discoverable=true,allow_contact_requests=true where id between 'f3000000-0000-4000-8000-000000000002' and 'f3000000-0000-4000-8000-000000000004';
set role authenticated;
set request.jwt.claim.sub='f3000000-0000-4000-8000-000000000001';
select public.create_company('Legacy handoff fixture','Synthetic populated legacy company for contact upgrade testing.','https://example.com','Karachi') as company \gset
select public.create_contact_request(:'company','f3000000-0000-4000-8000-000000000002','A pending request preserved through migration.');
select public.create_contact_request(:'company','f3000000-0000-4000-8000-000000000003','An accepted request preserved through migration.') as accepted \gset
select public.create_contact_request(:'company','f3000000-0000-4000-8000-000000000004','A declined request preserved through migration.') as declined \gset
set request.jwt.claim.sub='f3000000-0000-4000-8000-000000000003';
select public.respond_contact_request(:'accepted','accepted');
set request.jwt.claim.sub='f3000000-0000-4000-8000-000000000004';
select public.respond_contact_request(:'declined','declined');
reset role;
create table test_handoff_snapshot as select md5(jsonb_agg(to_jsonb(r) order by id)::text) as fingerprint from public.contact_requests r;
