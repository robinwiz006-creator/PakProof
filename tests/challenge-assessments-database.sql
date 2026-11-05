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
select public.review_assessed_submission(:'submission','approved','Private acceptance note for this fixture.','["met"]',:'rubric2');
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
do $$begin
 if not exists(select 1 from public.credential_issuance_audit where credential_id=current_setting('test.assessed_credential')::uuid and representative_id=auth.uid()) then raise exception 'Representative missing';end if;
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.assessment_org')::uuid,'Duplicate recognition','company_achievement','A retry must not duplicate the same work recognition.',current_date,null,'');raise exception 'Duplicate issuance';exception when unique_violation then null;end;
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.assessment_org')::uuid,'Unpermitted assessment','certification','A valid work type still needs specific issuer category permission.',current_date,null,'');raise exception 'Type permission bypass';exception when raise_exception then if sqlerrm='Type permission bypass' then raise;end if;end;
 if (select count(*) from public.credentials)<>1 then raise exception 'Failed issuance left partial credential';end if;
end$$;
update public.challenges set status='closed' where id=:'challenge';
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
do $$begin if (select count(*) from public.challenge_assessments)<>2 then raise exception 'Recipient lost assessments after challenge closed';end if;end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.register_organization('company','Other Assessment Fixture','A different synthetic organization owned by the same representative.','https://example.com/other') as other_org \gset
select set_config('test.other_assessment_org',:'other_org',true);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000013';
select public.review_issuer_authorization(:'other_org','Synthetic independent approval for another company.',true,'Other Assessment Fixture','A different synthetic organization owned by the same representative.','https://example.com/other',array['company_achievement'],null);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
do $$begin
 begin perform public.issue_challenge_credential(current_setting('test.assessment_submission')::uuid,current_setting('test.other_assessment_org')::uuid,'Wrong organization recognition','company_achievement','Even an authorized related member must use the challenge organization.',current_date,null,'');raise exception 'Wrong organization issued';exception when raise_exception then if sqlerrm='Wrong organization issued' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'credential','accepted',true,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if exists(select 1 from public.credential_challenge_context) then raise exception 'Private passport exposed work';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
update public.profiles set is_public=true where id=auth.uid();
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 if (select assessment from public.credential_challenge_context limit 1) is not null then raise exception 'Assessment shared without evidence consent';end if;
 begin perform 1 from public.challenge_assessments;raise exception 'Anonymous raw assessment';exception when insufficient_privilege then null;end;
 begin perform 1 from public.challenge_rubrics;raise exception 'Rubric creator leaked';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'credential','accepted',true,true);
set local role anon;
set local request.jwt.claim.sub='';
do $$declare m jsonb;d text;begin
 select assessment,context_digest into m,d from public.credential_challenge_context limit 1;
 if m is null or m->'outcomes'<>'["met"]' then raise exception 'Consented assessment missing';end if;
 if m ?| array['feedback','explanation','project_url','github_url','reviewer_id'] then raise exception 'Private reviewer/evidence data leaked';end if;
 if encode(sha256(convert_to(m::text,'UTF8')),'hex')<>d or (select program_name from public.credentials limit 1)<>'Assessed work · sha256:'||d then raise exception 'Manifest commitment missing';end if;
end$$;
reset role;
do $$begin
 begin update public.challenge_assessments set outcomes='[]';raise exception 'Assessment rewritten';exception when raise_exception then if sqlerrm='Assessment rewritten' then raise;end if;end;
 begin update public.submission_reviews set feedback='Rewritten review';raise exception 'Review rewritten';exception when raise_exception then if sqlerrm='Review rewritten' then raise;end if;end;
end$$;
rollback;
\echo 'PASS: versioned rubric/review, legacy bypass/stale guards, explicit scoped issuance, attribution, duplicates, consent, private notes and committed context'
