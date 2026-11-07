\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('90000000-0000-4000-8000-000000000011','{"full_name":"Assessment Representative"}'),
('90000000-0000-4000-8000-000000000012','{"full_name":"Assessment Recipient"}'),
('90000000-0000-4000-8000-000000000013','{"full_name":"Assessment Admin"}'),
('90000000-0000-4000-8000-000000000014','{"full_name":"Assessment Outsider"}');
insert into public.platform_administrators(user_id) values('90000000-0000-4000-8000-000000000013');
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.register_organization('company','Assessment Fixture','Synthetic company used to test assessed work and credentials.','https://example.com') as org \gset
select company_id from public.organizations where id=:'org' \gset
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company_id','title','Accessible interface fixture','description','Build an interface with keyboard and screen-reader support.','skills',jsonb_build_array('React'),'difficulty','Beginner','deadline',current_date+30,'deliverables','Deploy source and document keyboard behavior.'),'[{"title":"Accessibility","description":"Keyboard navigation must work."}]') as challenge \gset
select set_config('test.assessment_challenge',:'challenge',true),set_config('test.assessment_org',:'org',true);
select id as rubric from public.challenge_rubrics where challenge_id=:'challenge' \gset
select set_config('test.assessment_rubric',:'rubric',true);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.submit_work(:'challenge','https://example.com/private-work','','Synthetic private work explanation is never automatically published.') as submission \gset
select set_config('test.assessment_submission',:'submission',true);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000014';
do $$begin
 begin perform public.set_challenge_rubric(current_setting('test.assessment_challenge')::uuid,'[]');raise exception 'Outsider changed rubric';exception when raise_exception then if sqlerrm='Outsider changed rubric' then raise;end if;end;
 begin perform public.review_assessed_submission(current_setting('test.assessment_submission')::uuid,'approved','Outsider must not approve someone else work.','["met"]',current_setting('test.assessment_rubric')::uuid);raise exception 'Outsider reviewed';exception when raise_exception then if sqlerrm='Outsider reviewed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
do $$begin
 begin perform public.review_submission(current_setting('test.assessment_submission')::uuid,'approved','A legacy call cannot skip required assessment.');raise exception 'Rubric bypass';exception when raise_exception then if sqlerrm='Rubric bypass' then raise;end if;end;
 begin perform public.review_assessed_submission(current_setting('test.assessment_submission')::uuid,'approved','Incomplete work cannot be approved.','["needs_improvement"]',current_setting('test.assessment_rubric')::uuid);raise exception 'Unmet criteria approved';exception when raise_exception then if sqlerrm='Unmet criteria approved' then raise;end if;end;
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.assessment_org')::uuid,'Premature recognition','company_achievement','Unreviewed work cannot qualify for a credential.',current_date,null,'');raise exception 'Unreviewed credential';exception when raise_exception then if sqlerrm='Unreviewed credential' then raise;end if;end;
end$$;
select public.review_assessed_submission(:'submission','needs_improvement','Private reviewer feedback must never be in the public manifest.','["needs_improvement"]',:'rubric');
do $$begin
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.assessment_org')::uuid,'Incomplete work recognition','company_achievement','Work requiring revisions must not qualify for a credential.',current_date,null,'');raise exception 'Revision work qualified';exception when raise_exception then if sqlerrm='Revision work qualified' then raise;end if;end;
end$$;
select public.set_challenge_rubric(:'challenge','[{"title":"Accessible interface","description":"Keyboard navigation and visible focus must work."}]') as rubric2 \gset
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.submit_work(:'challenge','https://example.com/private-revised','','Updated private work explanation and revised keyboard support.');
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
do $$begin
 begin perform public.review_assessed_submission(current_setting('test.assessment_submission')::uuid,'approved','A stale rubric must not be silently accepted.','["met"]',current_setting('test.assessment_rubric')::uuid);raise exception 'Stale rubric accepted';exception when raise_exception then if sqlerrm='Stale rubric accepted' then raise;end if;end;
end$$;

select public.review_assessed_submission_details(:'submission','approved','Private acceptance note for this fixture.','["met"]',:'rubric2',jsonb_build_object('competencies',jsonb_build_array('Keyboard accessibility','React'),'method','code_review','summary','Implemented keyboard navigation and justified accessibility decisions.','score',4,'score_max',5,'assessed_on',(current_date-1)::text,'reviewer_id','PRIVATE reviewer impersonation','private_feedback','PRIVATE investigation note'));

do $$begin
 if (select count(*) from public.challenge_assessments)<>2 then raise exception 'Review snapshots missing';end if;
 if not exists(select 1 from public.challenge_assessments where criteria->0->>'title'='Accessibility' and outcomes='["needs_improvement"]') then raise exception 'Old rubric snapshot changed';end if;
 if (select count(*) from public.achievements)<>1 or exists(select 1 from public.credentials) then raise exception 'Approval automatically issued credential or lost achievement';end if;
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.assessment_org')::uuid,'Unapproved issuer recognition','company_achievement','Issuer permission is required for this new credential.',current_date,null,'');raise exception 'Unapproved issuer bypass';exception when raise_exception then if sqlerrm='Unapproved issuer bypass' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000013';
select public.review_issuer_authorization(:'org','Synthetic scope review for company work recognition.',true,'Assessment Fixture','Synthetic company used to test assessed work and credentials.','https://example.com',array['company_achievement'],null);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.issue_challenge_credential(:'submission',:'org','Assessed interface recognition','company_achievement','A separate decision recognizing approved interface work.',current_date,null,'') as credential \gset
select set_config('test.assessed_credential',:'credential',true);

select set_config('test.assessment_hash',(select context_digest from public.challenge_credential_sources where credential_id=:'credential'),true);
do $$declare m jsonb;begin
 select manifest into m from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid;
 if m->>'schema'<>'2' or m->'details'->>'method'<>'code_review' or m->'details'->>'score'<>'4' or m->'details'->>'challenge_level'<>'Beginner' or m->'details'->>'evaluating_organization'<>'Assessment Fixture' then raise exception 'Structured snapshot missing';end if;
 if m::text like '%PRIVATE%' or m->'details' ? 'reviewer_id' then raise exception 'Private reviewer data copied';end if;
 begin update public.challenge_assessments set details='{}' where submission_id=current_setting('test.assessment_submission')::uuid;raise exception 'Assessment edit bypass';exception when insufficient_privilege then null;end;
end$$;
update public.challenges set difficulty='Advanced',skills=array['SQL'] where id=:'challenge';
select public.set_challenge_rubric(:'challenge','[{"title":"Different criteria","description":"Later challenge criteria cannot replace prior review facts."}]');
do $$begin
 if (select manifest->'details'->>'challenge_level' from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid)<>'Beginner' then raise exception 'Current challenge overwrote assessment';end if;
 if (select context_digest from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid)<>current_setting('test.assessment_hash') then raise exception 'Issued assessment commitment changed';end if;
end$$;
select public.correct_credential(:'credential','Correct the certificate title without changing assessment facts.','Corrected assessed credential','Recognition for the same reviewed accessible interface work.',current_date,null,(select program_name from public.credentials where id=:'credential'),'',(select evidence_url from public.credential_evidence where credential_id=:'credential')) as replacement \gset
select set_config('test.assessment_replacement',:'replacement',true);
do $$begin
 if (select manifest from public.challenge_credential_sources where credential_id=current_setting('test.assessment_replacement')::uuid) is distinct from (select manifest from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid) then raise exception 'Correction silently changed assessed evidence';end if;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
update public.profiles set is_public=true where id=auth.uid();
select public.respond_credential(:'credential','accepted',true,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 if exists(select 1 from public.credential_challenge_context where credential_id=current_setting('test.assessed_credential')::uuid and assessment is not null) then raise exception 'Assessment published without evidence consent';end if;
 begin perform 1 from public.challenge_assessments;raise exception 'Public private assessment access';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'credential','accepted',true,true);
set local role anon;
set local request.jwt.claim.sub='';
do $$declare a jsonb;begin
 select assessment into a from public.credential_challenge_context where credential_id=current_setting('test.assessed_credential')::uuid;
 if a is null or a->'details'->>'reviewer_attributed'<>'true' or a->'details'->>'method'<>'code_review' then raise exception 'Consented assessment unavailable';end if;
 if a::text like '%PRIVATE%' or a->'details' ?| array['reviewer_id','feedback','private_feedback'] then raise exception 'Private content published';end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.revoke_credential(:'credential','Original record revoked; committed assessment remains historical.');
do $$begin
 if (select context_digest from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid)<>current_setting('test.assessment_hash') then raise exception 'Revocation rewrote assessment';end if;
end$$;
rollback;
\echo 'PASS: optional structured review snapshots, evidence consent, reviewer privacy, immutable history, corrected credentials and revocation'
