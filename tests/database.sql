\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('10000000-0000-4000-8000-000000000001','{"full_name":"Ayesha Khan"}'),
('20000000-0000-4000-8000-000000000001','{"full_name":"Karachi Reviewer"}'),
('30000000-0000-4000-8000-000000000001','{"full_name":"Other Reviewer"}');
set local role authenticated;
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select public.create_company('Karachi Labs','A demonstration product studio in Karachi.','https://example.com','Karachi') as company_id \gset
insert into public.challenges(company_id,title,description,skills,difficulty,deadline,deliverables) values (:'company_id','Responsive dashboard','Build an accessible dashboard with clear sales trends.',array['React'],'Intermediate',current_date+30,'A deployed demo and public source repository.') returning id as challenge_id \gset
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
select public.create_company('Other Company','Another demonstration company for access checks.','https://example.com','Lahore');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.submit_work(:'challenge_id','https://example.com/ayesha','https://github.com/example/demo','An accessible dashboard with responsive charts and documented tradeoffs.') as submission_id \gset
select set_config('test.submission_id',:'submission_id',true);
select set_config('test.company_id',:'company_id',true);
select set_config('test.challenge_id',:'challenge_id',true);
-- Talent can see their own submission but cannot directly approve or issue achievements.
do $$ begin
 if (select count(*) from public.challenge_submissions)<>1 then raise exception 'Own submission missing';end if;
 begin update public.challenge_submissions set status='approved';raise exception 'Direct approval was allowed';exception when insufficient_privilege then null;end;
 begin insert into public.achievements(submission_id,challenge_id,talent_id,company_id,title) values(current_setting('test.submission_id')::uuid,current_setting('test.challenge_id')::uuid,auth.uid(),current_setting('test.company_id')::uuid,'Forged');raise exception 'Achievement forgery allowed';exception when insufficient_privilege then null;end;
 begin perform public.review_submission(current_setting('test.submission_id')::uuid,'approved','I approve my own submission.');raise exception 'Self approval allowed';exception when raise_exception then if sqlerrm='Self approval allowed' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.challenge_submissions)<>0 then raise exception 'Other company can read submissions';end if;
 begin perform public.review_submission(current_setting('test.submission_id')::uuid,'approved','I should not be able to approve this.');raise exception 'Cross-company approval allowed';exception when raise_exception then if sqlerrm='Cross-company approval allowed' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select public.review_submission(:'submission_id','needs_improvement','Please add keyboard accessible controls to the charts.');
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
select public.submit_work(:'challenge_id','https://example.com/ayesha-v2','https://github.com/example/demo','Updated the charts with keyboard controls and tested accessibility.');
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
select public.review_submission(:'submission_id','approved','Reviewed the updated demo and source. All deliverables are satisfied.') as achievement_id \gset
select set_config('test.achievement_id',:'achievement_id',true);
do $$ begin
 if (select count(*) from public.achievements)<>1 then raise exception 'Achievement not created';end if;
 if (select status from public.challenge_submissions where id=current_setting('test.submission_id')::uuid)<>'approved' then raise exception 'Approval not stored';end if;
 if (select count(*) from public.submission_reviews)<>2 then raise exception 'Review history missing';end if;
 begin perform public.review_submission(current_setting('test.submission_id')::uuid,'approved','Duplicate approval must not create another achievement.');raise exception 'Duplicate approval allowed';exception when raise_exception then if sqlerrm='Duplicate approval allowed' then raise;end if;end;
 begin insert into public.blockchain_proofs(achievement_id,signature,record_hash,issuer_wallet,anchored_at) values(current_setting('test.achievement_id')::uuid,'fake',repeat('a',64),'fake',now());raise exception 'Client proof forgery allowed';exception when insufficient_privilege then null;end;
end $$;
-- Private passport is hidden to anonymous visitors; publication reveals the achievement.
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin if (select count(*) from public.achievements)<>0 or (select count(*) from public.profiles)<>0 then raise exception 'Private passport leaked';end if;end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.profiles set is_public=true where id=auth.uid();
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin if (select count(*) from public.achievements)<>1 or (select count(*) from public.profiles)<>1 then raise exception 'Public passport missing';end if;end $$;
rollback;
\echo 'PASS: creation, submission, revision, approval, public passport, and forbidden writes'
