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
-- Phase 1: private evidence, immutable approvals, project ownership/editing and recipient consent.
do $$ begin
 if (select count(*) from public.achievement_claims)<>1 then raise exception 'Claim snapshot missing';end if;
 if (select count(*) from public.achievement_evidence)<>0 then raise exception 'Private approved evidence leaked';end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
insert into public.projects(talent_id,title,description,demo_url,skills) values(auth.uid(),'Original project','A portfolio project with real supporting evidence.','https://example.com/portfolio',array['React']) returning id as project_id \gset
update public.projects set title='Edited same project' where id=:'project_id';
select set_config('test.project_id',:'project_id',true);
do $$ begin
 if (select count(*) from public.projects where id=current_setting('test.project_id')::uuid and title='Edited same project')<>1 then raise exception 'Project edit did not update original';end if;
 if (select count(*) from public.achievement_evidence)<>1 then raise exception 'Recipient cannot read approved evidence';end if;
end $$;
insert into public.achievement_sharing(achievement_id,share_evidence,project_id) values(:'achievement_id',true,:'project_id');
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin if (select count(*) from public.achievement_evidence)<>1 then raise exception 'Consented evidence missing';end if; end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.achievement_sharing set share_evidence=false where achievement_id=:'achievement_id';
update public.profiles set is_public=false where id=auth.uid();
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';
insert into public.projects(talent_id,title,description,demo_url) values(auth.uid(),'Other person project','A private portfolio belonging to another person.','https://example.com/other') returning id as other_project \gset
select set_config('test.other_project',:'other_project',true);
do $$ declare n integer; begin
 update public.projects set title='Unauthorized edit' where id=current_setting('test.project_id')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Other person edited project';end if;
 if (select count(*) from public.achievement_evidence)<>0 then raise exception 'Other company read private evidence';end if;
 begin insert into public.achievement_sharing(achievement_id,share_evidence) values(current_setting('test.achievement_id')::uuid,true);raise exception 'Other company set sharing';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
do $$ begin
 begin update public.achievement_sharing set project_id=current_setting('test.other_project')::uuid;raise exception 'Foreign project linked';exception when raise_exception then if sqlerrm='Foreign project linked' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='20000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from public.projects where id=current_setting('test.project_id')::uuid) then raise exception 'Reviewer saw unrelated private portfolio';end if;
 if (select count(*) from public.achievement_evidence)<>1 then raise exception 'Authorized reviewer lost submitted evidence';end if;
end $$;
set local role postgres;
do $$ begin
 begin update public.achievements set title='Changed fact' where id=current_setting('test.achievement_id')::uuid;raise exception 'Approved fact changed';exception when raise_exception then if sqlerrm='Approved fact changed' then raise;end if;end;
 begin update public.achievement_evidence set explanation='Changed approved work';raise exception 'Approved evidence changed';exception when raise_exception then if sqlerrm='Approved evidence changed' then raise;end if;end;
 if exists(select 1 from public.achievement_claims c join public.achievement_evidence e using(achievement_id) where c.evidence_digest<>encode(sha256(convert_to(jsonb_build_array(e.digest_salt,e.challenge_title,e.challenge_description,e.deliverables,e.project_url,e.github_url,e.explanation)::text,'UTF8')),'hex')) then raise exception 'Evidence digest mismatch';end if;
end $$;
set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';
update public.achievement_sharing set project_id=current_setting('test.project_id')::uuid where achievement_id=current_setting('test.achievement_id')::uuid;
delete from public.projects where id=current_setting('test.project_id')::uuid;
do $$ begin
 if exists(select 1 from public.achievement_sharing where project_id is not null) then raise exception 'Removed project association not cleared';end if;
 if (select count(*) from public.achievements)<>1 or (select count(*) from public.achievement_evidence)<>1 then raise exception 'Removing project changed approved work';end if;
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$ begin if (select count(*) from public.achievement_evidence)<>0 or (select count(*) from public.achievement_claims)<>0 then raise exception 'Private evidence or claim leaked after privacy change';end if;end $$;
do $$ begin
 if encode(sha256(convert_to(jsonb_build_array('salt','نام "title"',E'line\nnext','demo','https://example.com/a','',E'Test \\ evidence')::text,'UTF8')),'hex')<>'0ce8c81d290d6b0e810dbff8d4e6be20c7138ae129bd263e63d53d504411a702' then raise exception 'SQL/JavaScript evidence encoding differs';end if;
end $$;
rollback;
\echo 'PASS: creation, submission, revision, approval, public passport, and forbidden writes'
