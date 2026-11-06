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

select public.correct_credential(:'credential','Private investigation correction reason','Corrected work title','The corrected title describes the same assessed work.',current_date,null,(select program_name from public.credentials where id=:'credential'),'',(select evidence_url from public.credential_evidence where credential_id=:'credential')) as replacement \gset
select set_config('test.correction',:'replacement',true);
do $$declare a public.challenge_credential_sources;b public.challenge_credential_sources;begin
 select * into a from public.challenge_credential_sources where credential_id=current_setting('test.assessed_credential')::uuid;
 select * into b from public.challenge_credential_sources where credential_id=current_setting('test.correction')::uuid;
 if b.correction_root_id<>a.credential_id or b.manifest<>a.manifest or b.context_digest<>a.context_digest or b.review_id<>a.review_id then raise exception 'Assessment commitment changed';end if;
 if not exists(select 1 from public.credential_preferences where credential_id=b.credential_id and acceptance='pending' and not is_public and not share_evidence) then raise exception 'Consent inherited';end if;
 begin perform public.issue_challenge_credential(a.submission_id,a.organization_id,'Duplicate recognition','company_achievement','A new initial record must remain forbidden.',current_date,null,'');raise exception 'Duplicate bypass';exception when unique_violation then null;end;
 begin perform public.correct_credential(a.credential_id,'Another private correction reason','Concurrent replacement','Another live replacement must be denied.',current_date,null,'','','');raise exception 'Duplicate correction';exception when raise_exception then if sqlerrm='Duplicate correction' then raise;end if;end;
 begin update public.credential_corrections set state='accepted';raise exception 'Client forged supersession';exception when insufficient_privilege then null;end;
 begin update public.credentials set title='Rewritten original' where id=a.credential_id;raise exception 'Facts rewritten';exception when others then if sqlerrm='Facts rewritten' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000014';
do $$begin
 if exists(select 1 from public.credential_corrections) then raise exception 'Private audit leaked';end if;
 begin perform public.correct_credential(current_setting('test.assessed_credential')::uuid,'Unauthorized correction reason','Unauthorized replacement','An unrelated actor must never correct this record.',current_date,null,'','','');raise exception 'Unauthorized correction';exception when raise_exception then if sqlerrm='Unauthorized correction' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
update public.profiles set is_public=true where id=auth.uid();
select public.respond_credential(:'credential','accepted',true,false);
select public.respond_credential(:'replacement','declined',false,false);
do $$begin
 if (select superseded from public.credential_correction_status where credential_id=current_setting('test.assessed_credential')::uuid) then raise exception 'Decline superseded original';end if;
 begin perform public.respond_credential(current_setting('test.correction')::uuid,'accepted',false,false);raise exception 'Closed proposal accepted';exception when raise_exception then if sqlerrm='Closed proposal accepted' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.correct_credential(:'credential','Second private correction reason','Accepted corrected work','The corrected title describes this approved work accurately.',current_date,null,(select program_name from public.credentials where id=:'credential'),'',(select evidence_url from public.credential_evidence where credential_id=:'credential')) as replacement2 \gset
select set_config('test.correction2',:'replacement2',true);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'replacement2','accepted',false,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$declare r jsonb;begin
 select to_jsonb(s) into r from public.credential_correction_status s where credential_id=current_setting('test.assessed_credential')::uuid;
 if r is null or r->>'superseded'<>'true' or r->>'replacement_id' is not null or r->>'pending_replacement_id' is not null then raise exception 'Private replacement leaked or original not superseded';end if;
 if exists(select 1 from public.credentials where id=current_setting('test.correction2')::uuid) then raise exception 'Private correction exposed';end if;
 begin perform 1 from public.credential_corrections;raise exception 'Anonymous raw audit access';exception when insufficient_privilege then null;end;
 if public.credential_replacement_tip(current_setting('test.assessed_credential')::uuid) is not null then raise exception 'Private helper RPC exposed';end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'replacement2','accepted',true,false);
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select public.revoke_credential(:'credential','The historical record was revoked and must remain revoked.');
select public.revoke_credential(:'replacement2','This corrected record also needs a further correction.');
select public.correct_credential(:'replacement2','Third private correction reason','Third corrected work','A further correction retains all previous assessment references.',current_date,null,(select program_name from public.credentials where id=:'replacement2'),'',(select evidence_url from public.credential_evidence where credential_id=:'replacement2')) as replacement3 \gset
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000012';
select public.respond_credential(:'replacement3','accepted',true,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 if not exists(select 1 from public.public_credential_events where credential_id=current_setting('test.assessed_credential')::uuid) then raise exception 'Revocation history lost';end if;
 if (select replacement_id from public.credential_correction_status where credential_id=current_setting('test.assessed_credential')::uuid) is null then raise exception 'Current published replacement missing';end if;
end$$;
rollback;
\echo 'Credential correction database suite passed (including assessed-work, consent, privacy, immutable source and revocation checks)'
