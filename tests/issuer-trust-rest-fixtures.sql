-- Additional synthetic fixtures for the real local PostgREST trust tests.
insert into auth.users(id,raw_user_meta_data) values('a0000000-0000-4000-8000-000000000005','{"full_name":"Trust REST Admin"}');
insert into public.platform_administrators(user_id) values('a0000000-0000-4000-8000-000000000005');
set role authenticated;
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true where id=auth.uid();
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select company_id from public.paid_projects limit 1 \gset
select public.register_organization('training','Privacy Fixture','Disposable local privacy test organization.','https://example.com',:'company_id') as org \gset
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000005';
select public.review_issuer_authorization(:'org','Synthetic training-course review for isolated REST tests.',true,'Privacy Fixture','Disposable local privacy test organization.','https://example.com',array['course'],null);
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','a0000000-0000-4000-8000-000000000002','Public REST course','course','Synthetic public course for privacy and scope testing.',current_date,null,'','','') as credential \gset
select public.issue_credential(:'org','a0000000-0000-4000-8000-000000000002','Private REST course','course','Synthetic private course for privacy and scope testing.',current_date,null,'','','');
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
reset role;
