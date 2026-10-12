-- Local-only fixtures to test additive migration preservation. Not real proofs.
insert into auth.users(id,raw_user_meta_data) values
('90000000-0000-4000-8000-000000000001','{"full_name":"Legacy Talent"}'),
('90000000-0000-4000-8000-000000000002','{"full_name":"Legacy Reviewer"}');
insert into public.companies(id,name,description) values('90000000-0000-4000-8000-000000000003','Legacy company','Local migration fixture company');
insert into public.company_memberships(company_id,user_id,role) values('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000002','owner');
insert into public.projects(id,talent_id,title,description,demo_url) values('90000000-0000-4000-8000-000000000004','90000000-0000-4000-8000-000000000001','Legacy project','Evidence that must survive a migration','https://example.com/legacy');
insert into public.challenges(id,company_id,title,description,difficulty,deadline,deliverables) values('90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000003','Legacy challenge','Original approved challenge','Beginner',current_date+30,'Original deliverables');
insert into public.challenge_submissions(id,challenge_id,talent_id,project_url,explanation,status) values('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000001','https://example.com/approved','Original explanation of the approved work.','approved');
insert into public.submission_reviews(submission_id,reviewer_id,decision,feedback) values('90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000002','approved','Original approval feedback');
insert into public.achievements(id,submission_id,challenge_id,talent_id,company_id,title,issued_at) values('90000000-0000-4000-8000-000000000007','90000000-0000-4000-8000-000000000006','90000000-0000-4000-8000-000000000005','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','Legacy approved title','2026-10-11T00:00:00Z');
insert into public.blockchain_proofs(achievement_id,signature,record_hash,issuer_wallet,anchored_at) values('90000000-0000-4000-8000-000000000007','offline-fixture-not-a-transaction',repeat('a',64),'offline-wallet','2026-10-11T00:01:00Z');
create table public.test_preservation_baseline(name text primary key,data jsonb);
do $$ declare t text; data jsonb; begin foreach t in array array['profiles','companies','company_memberships','skills','projects','challenges','challenge_submissions','submission_reviews','achievements','blockchain_proofs'] loop execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',t) into data;insert into public.test_preservation_baseline values(t,data);end loop;end $$;
