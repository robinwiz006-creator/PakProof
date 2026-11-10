\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) select ('25000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('full_name','Matching fixture '||n) from generate_series(1,5) n;
insert into public.platform_administrators(user_id) values('25000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
select public.create_company('Matching Fixture','Synthetic organization for evidence matching tests.','https://example.test','') as company \gset
select public.register_organization('training','Matching Fixture','Synthetic organization for evidence matching tests.','https://example.test',:'company') as org \gset
select set_config('test.match_company',:'company',true);
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Solana interface challenge','description','Build an accessible interface with clear test evidence.','skills',jsonb_build_array('Solana','React'),'difficulty','Beginner','deadline',current_date+20,'deliverables','Provide accessible source and a working demonstration.'),'[{"title":"Accessibility","description":"All inputs work with a keyboard."}]') as challenge \gset
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Second opportunity','description','A second distinct opportunity for the same candidate.','skills',jsonb_build_array('Solana'),'difficulty','Beginner','deadline',current_date+20,'deliverables','Provide source and evidence.'),'[]') as challenge2 \gset
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Expiring opportunity','description','An opportunity used to verify expiry and closure controls.','skills',jsonb_build_array('Solana'),'difficulty','Beginner','deadline',current_date+20,'deliverables','Provide source and evidence.'),'[]') as challenge3 \gset
select public.create_paid_project(:'company','Paid interface project','Build a synthetic interface with approved milestones.','Provide accessible source and clear evidence.',array['Solana'],current_date+20,'1000000',jsonb_build_array(jsonb_build_object('title','Interface milestone','deliverables','Working interface with source code.','deadline',current_date+10,'amount_units','1000000'))) as project \gset
select public.publish_paid_project(:'project');
select set_config('test.match_challenge',:'challenge',true);
select set_config('test.match_challenge2',:'challenge2',true);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true,skills=array['Solana','React'] where id=auth.uid();
select public.set_discovery_preferences(true,true);
insert into public.passport_history(owner_id,kind,organization,title,field,start_date,end_date,is_public) values(auth.uid(),'education','Public Institute','Computing diploma','Software','2020-01-01','2024-01-01',true);
insert into public.passport_history(owner_id,kind,organization,title,start_date,ongoing,is_public) values(auth.uid(),'employment','Public Employer','Frontend developer','2024-01-01',true,true),(auth.uid(),'education','Hidden School Marker','Private qualification','2023-01-01',true,false);
insert into public.projects(talent_id,title,description,demo_url,skills) values(auth.uid(),'Solana interface project','Public React interface for Solana workflows.','https://example.test/public',array['Solana']);
select public.submit_work(:'challenge','https://example.test/private-evidence','','Private reviewer and submission text must not leak.') as submission \gset
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
select id as rubric from public.challenge_rubrics where challenge_id=:'challenge' \gset
select public.review_assessed_submission(:'submission','approved','Private review note should never enter directory results.','["met"]',:'rubric') as achievement \gset
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
insert into public.achievement_sharing(achievement_id,share_assessment) values(:'achievement',true);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000003';
select public.review_issuer_authorization(:'org','Synthetic training evidence reviewed by separate admin.',true,'Matching Fixture','Synthetic organization for evidence matching tests.','https://example.test',array['course'],null);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','25000000-0000-4000-8000-000000000002','Solana course','course','Completed a synthetic course with public work.',current_date,null,'','','') as credential \gset
select set_config('test.match_credential',:'credential',true);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
do $$declare r jsonb;begin
 r=public.search_passports_evidence(current_setting('test.match_company')::uuid,p_skill=>'solana,react',p_credentials=>true,p_assessed=>true,p_education=>'computing',p_experience=>'frontend',p_project=>'interface',p_category=>'course',p_completed=>true,p_sort=>'relevance');
 if (r->>'total')::int<>1 or r->'items'->0->>'matched_skills'<>'2' or r->'items'->0->>'assessed_matches'<>'1' or r->'items'->0->>'matching_projects'<>'1' then raise exception 'Combined filters or relevance counts failed';end if;
 if jsonb_array_length(r->'items'->0->'history')<>2 or position('Hidden School' in r::text)>0 or position('Private review' in r::text)>0 or position('private-evidence' in r::text)>0 then raise exception 'Private history or assessment leaked';end if;
 if r->'items'->0->'credentials'->0->>'trust_level'<>'self_registered' then raise exception 'Unreviewed institution misrepresented';end if;
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_education=>'Hidden School')->>'total')::int<>0 then raise exception 'Hidden education filter leaks';end if;
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_skill=>'Solana,Python')->>'total')::int<>0 then raise exception 'All-skills filter failed';end if;
 if jsonb_array_length(public.search_passports_evidence(current_setting('test.match_company')::uuid,p_page=>2)->'items')<>0 then raise exception 'Paging ignored';end if;
end$$;
select public.save_candidate_for_opportunity(:'company','25000000-0000-4000-8000-000000000002','Short internal note',:'challenge',null);
do $$begin
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_saved=>true,p_opportunity=>'challenge:'||current_setting('test.match_challenge'))->>'total')::int<>1 then raise exception 'Opportunity shortlist group failed';end if;
end$$;
select public.invite_candidate_to_opportunity(:'company','25000000-0000-4000-8000-000000000002','Please consider our public Solana interface challenge.',:'challenge',null) as request \gset
select set_config('test.match_request',:'request',true);
select public.invite_candidate_to_opportunity(:'company','25000000-0000-4000-8000-000000000002','Please consider this second distinct public challenge.',:'challenge2',null) as request2 \gset
select public.invite_candidate_to_opportunity(:'company','25000000-0000-4000-8000-000000000002','Please consider our expiring public challenge.',:'challenge3',null) as request3 \gset
select set_config('test.match_request3',:'request3',true);
select public.invite_candidate_to_opportunity(:'company','25000000-0000-4000-8000-000000000002','Consider our published devnet test-token paid project.',null,:'project') as paid_invite \gset

do $$begin
 begin perform public.invite_candidate_to_opportunity(current_setting('test.match_company')::uuid,'25000000-0000-4000-8000-000000000002','This duplicate invitation must be rejected.',current_setting('test.match_challenge')::uuid,null);raise exception 'Duplicate invitation';exception when raise_exception then if sqlerrm='Duplicate invitation' then raise;end if;end;
 begin update public.contact_requests set status='accepted';raise exception 'Client forged acceptance';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000004';
do $$begin
 if exists(select 1 from public.employer_shortlists) or exists(select 1 from public.visible_contact_requests) then raise exception 'Organization isolation failed';end if;
 begin perform public.search_passports_evidence(current_setting('test.match_company')::uuid);raise exception 'Unrelated discovery';exception when raise_exception then if sqlerrm='Unrelated discovery' then raise;end if;end;
 begin perform public.invite_candidate_to_opportunity(current_setting('test.match_company')::uuid,'25000000-0000-4000-8000-000000000002','An unrelated person cannot impersonate an employer.',current_setting('test.match_challenge')::uuid,null);raise exception 'Unrelated invitation';exception when raise_exception then if sqlerrm='Unrelated invitation' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
select public.respond_contact_request(:'request','accepted');
select public.respond_contact_request(:'request2','declined');
select public.respond_contact_request(:'paid_invite','accepted');
do $$begin
 if exists(select 1 from public.paid_project_applications where worker_id=auth.uid()) then raise exception 'Invitation auto applied';end if;
end$$;
reset role;
update public.contact_requests set expires_at=now()-interval '1 second' where id=:'request3';
set local role authenticated;
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
do $$begin
 if not exists(select 1 from public.visible_contact_requests where id=current_setting('test.match_request3')::uuid and status='expired') then raise exception 'Expiry presentation failed';end if;
 begin perform public.respond_contact_request(current_setting('test.match_request3')::uuid,'accepted');raise exception 'Expired accepted';exception when raise_exception then if sqlerrm='Expired accepted' then raise;end if;end;
end$$;
select public.set_discovery_preferences(false,false);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
do $$begin
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_saved=>true)->>'total')::int<>0 or exists(select 1 from public.employer_shortlists) or exists(select 1 from public.visible_contact_requests) then raise exception 'Opt-out leaked saved profile or invitation';end if;
end$$;
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
select public.set_discovery_preferences(true,true);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
select public.correct_credential(:'credential','Correct the synthetic course title without rewriting history.','Corrected Solana course','Corrected synthetic course with the same underlying work.',current_date,null,'','','') as replacement \gset
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000002';
select public.respond_credential(:'replacement','accepted',false,false);
set local request.jwt.claim.sub='25000000-0000-4000-8000-000000000001';
do $$begin
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_credentials=>true)->>'total')::int<>0 then raise exception 'Superseded or private replacement satisfies current filter';end if;
 if public.search_passports_evidence(current_setting('test.match_company')::uuid)->'items'->0->'credentials'->0->>'validity'<>'Superseded' then raise exception 'Supersession missing';end if;
end$$;
select public.revoke_credential(:'credential','This synthetic credential has been withdrawn.');
do $$begin
 if (public.search_passports_evidence(current_setting('test.match_company')::uuid,p_credentials=>true)->>'total')::int<>0 then raise exception 'Revoked credential satisfies current filter';end if;
 if public.search_passports_evidence(current_setting('test.match_company')::uuid)->'items'->0->'credentials'->0->>'validity'<>'Revoked' then raise exception 'Revoked status hidden';end if;
end$$;
select public.remove_saved_candidate(:'company','25000000-0000-4000-8000-000000000002');
do $$begin if exists(select 1 from public.employer_shortlists) then raise exception 'Unsave failed';end if;end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 begin perform public.search_passports_evidence(current_setting('test.match_company')::uuid);raise exception 'Anonymous search';exception when insufficient_privilege then null;end;
end$$;
rollback;
