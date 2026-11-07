-- Forward-only: optional new-review metadata, existing rubric/evidence reused.
-- Stored schema-1 manifests and Solana v1/v2/v3 formats are unchanged.
begin;
alter table public.challenge_assessments add column details jsonb;
create function public.review_assessed_submission_details(p_submission_id uuid,p_decision text,p_feedback text,p_outcomes jsonb,p_expected_rubric uuid,p_details jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare s public.challenge_submissions;c public.challenges;r public.challenge_rubrics;v_review uuid;v_achievement uuid;detail jsonb;score integer;maximum integer;assessed date;begin
 select * into s from public.challenge_submissions where id=p_submission_id for update;
 select * into c from public.challenges where id=s.challenge_id for update;
 if s.id is null or auth.uid() is null or not public.is_company_member(c.company_id) or s.talent_id=auth.uid() then raise exception 'You cannot review this submission';end if;
 if s.status<>'pending' or p_decision is null or p_decision not in ('approved','needs_improvement') or p_feedback is null or length(trim(p_feedback)) not between 10 and 3000 then raise exception 'Review pending work and give a decision and feedback';end if;
 select * into r from public.challenge_rubrics where challenge_id=c.id order by version desc limit 1;
 if r.id is distinct from p_expected_rubric then raise exception 'Assessment criteria changed. Reload and review the current version';end if;
 if p_outcomes is null or jsonb_typeof(p_outcomes)<>'array' then raise exception 'Assess each criterion';end if;
 if jsonb_array_length(p_outcomes)<>jsonb_array_length(coalesce(r.criteria,'[]')) or exists(select 1 from jsonb_array_elements(p_outcomes) x where jsonb_typeof(x)<>'string' or x#>>'{}' not in ('met','needs_improvement','not_assessed')) then raise exception 'Assess each criterion with a supported outcome';end if;
 if p_decision='approved' and exists(select 1 from jsonb_array_elements_text(p_outcomes) x where x<>'met') then raise exception 'Approval requires every defined criterion to be met';end if;

 if p_details is not null then
 if jsonb_typeof(p_details)<>'object' or jsonb_typeof(p_details->'competencies') is distinct from 'array' or jsonb_array_length(p_details->'competencies') not between 1 and 8
 or exists(select 1 from jsonb_array_elements(p_details->'competencies') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 2 and 80)
 or jsonb_typeof(p_details->'method') is distinct from 'string' or (p_details->>'method') not in ('practical_project','code_review','written_test','interview','portfolio_review')
 or jsonb_typeof(p_details->'summary') is distinct from 'string' or length(trim(p_details->>'summary')) not between 20 and 1500
 then raise exception 'Provide competencies, a supported assessment method and a clear publication-ready result summary';end if;
 if nullif(p_details->>'score','') is not null or nullif(p_details->>'score_max','') is not null then
 if jsonb_typeof(p_details->'score') is distinct from 'number' or jsonb_typeof(p_details->'score_max') is distinct from 'number' or (p_details->>'score') !~ '^[0-9]{1,4}$' or (p_details->>'score_max') !~ '^[0-9]{1,4}$' then raise exception 'Use a whole-number score and maximum together, or leave both empty';end if;
 score=(p_details->>'score')::integer;maximum=(p_details->>'score_max')::integer;
 if maximum not between 1 and 1000 or score<0 or score>maximum then raise exception 'Score must be between zero and its maximum (at most 1000)';end if;end if;
 if nullif(p_details->>'assessed_on','') is not null then
 if jsonb_typeof(p_details->'assessed_on') is distinct from 'string' or (p_details->>'assessed_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Use a valid assessment date';end if;
 assessed=(p_details->>'assessed_on')::date;if assessed>current_date then raise exception 'Assessment date cannot be in the future';end if;end if;
 -- Whitelist public-summary fields. Never copy feedback, staff UUIDs or client
 -- claims about evaluator authorization. Existing rubric/review/evidence remain authoritative.
 detail=jsonb_build_object('competencies',(select jsonb_agg(trim(x#>>'{}') order by ord) from jsonb_array_elements(p_details->'competencies') with ordinality t(x,ord)),
 'method',p_details->>'method','summary',trim(p_details->>'summary'),'score',score,'score_max',maximum,'assessed_on',assessed,
 'challenge_level',c.difficulty,'level_definition',case c.difficulty when 'Beginner' then 'A bounded task using standard approaches, with guidance where needed.' when 'Intermediate' then 'Independent delivery of multi-part work and explanation of decisions.' when 'Advanced' then 'Complex constraints, independent judgement and justified trade-offs.' end,'evaluating_organization',(select name from public.companies where id=c.company_id),'reviewer_attributed',true);
 end if;
 insert into public.submission_reviews(submission_id,reviewer_id,decision,feedback) values(s.id,auth.uid(),p_decision,p_feedback) returning id into v_review;
 insert into public.challenge_assessments(review_id,submission_id,challenge_id,rubric_id,criteria,outcomes,details) values(v_review,s.id,c.id,r.id,coalesce(r.criteria,'[]'),p_outcomes,detail);
 update public.challenge_submissions set status=p_decision where id=s.id;
 if p_decision='approved' then insert into public.achievements(submission_id,challenge_id,talent_id,company_id,title) values(s.id,c.id,s.talent_id,c.company_id,c.title) returning id into v_achievement;end if;
 return v_achievement;end;$$;
create or replace function public.review_assessed_submission(p_submission_id uuid,p_decision text,p_feedback text,p_outcomes jsonb,p_expected_rubric uuid) returns uuid language plpgsql security definer set search_path='' as $$begin
 return public.review_assessed_submission_details(p_submission_id,p_decision,p_feedback,p_outcomes,p_expected_rubric,null);end;$$;
create or replace function public.issue_challenge_credential(p_submission uuid,p_organization uuid,p_title text,p_type text,p_description text,p_issue_date date,p_expiry_date date,p_award text) returns uuid language plpgsql security definer set search_path='' as $$
 declare s public.challenge_submissions;c public.challenges;o public.organizations;a public.achievements;r public.submission_reviews;assessment public.challenge_assessments;e public.achievement_evidence;v uuid=gen_random_uuid();salt uuid=gen_random_uuid();ev text;manifest jsonb;digest text;begin
 select * into s from public.challenge_submissions where id=p_submission for update;
 select * into c from public.challenges where id=s.challenge_id;
 select * into o from public.organizations where id=p_organization for share;
 if s.id is null or s.status<>'approved' or o.company_id is distinct from c.company_id or not public.organization_member(o.id) then raise exception 'Choose approved work belonging to your organization';end if;
 if o.issuer_status is distinct from 'authorized' or o.authorization_id is null or not coalesce(p_type=any(o.allowed_credential_types),false) then raise exception 'An authorized organization with this credential category is required';end if;
 if p_type is null or p_type not in ('certification','company_achievement','hackathon_participation','hackathon_achievement') then raise exception 'Choose a supported work-recognition credential type';end if;
 select * into a from public.achievements where submission_id=s.id;
 select * into r from public.submission_reviews where submission_id=s.id and decision='approved' order by created_at desc,id desc limit 1;
 if a.id is null or r.id is null then raise exception 'An approved review and achievement are required';end if;
 select * into assessment from public.challenge_assessments where review_id=r.id;
 select * into e from public.achievement_evidence where achievement_id=a.id;
 if e.achievement_id is null then raise exception 'Approved evidence snapshot missing';end if;
 manifest=jsonb_build_object('schema',1,'challenge_id',c.id,'challenge_title',a.title,'submission_id',s.id,'review_id',r.id,'organization_id',o.id,'recipient_id',s.talent_id,'reviewed_at',r.created_at,'rubric_id',assessment.rubric_id,'criteria',coalesce(assessment.criteria,'[]'),'outcomes',coalesce(assessment.outcomes,'[]'),'evidence_digest',(select evidence_digest from public.achievement_claims where achievement_id=a.id));
 if assessment.details is not null then manifest=manifest||jsonb_build_object('schema',2,'details',assessment.details,'context_salt',salt);end if;
 digest=encode(sha256(convert_to(manifest::text,'UTF8')),'hex');
 ev=coalesce(nullif(e.project_url,''),e.github_url);
 -- Task 4 insert trigger enforces current type permissions and staff attribution.
 -- Recipient is derived from approved work, never a private-profile/email lookup.
 insert into public.credentials(id,organization_id,authorization_id,recipient_id,issuer_name,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_digest)
 values(v,o.id,o.authorization_id,s.talent_id,(select name from public.companies where id=o.company_id),p_title,p_type,p_description,p_issue_date,p_expiry_date,'Assessed work · sha256:'||digest,coalesce(p_award,''),encode(sha256(convert_to(jsonb_build_array(salt::text,ev)::text,'UTF8')),'hex'));
 insert into public.credential_evidence(credential_id,evidence_url,digest_salt) values(v,ev,salt);
 insert into public.credential_preferences(credential_id) values(v);
 insert into public.challenge_credential_sources(credential_id,submission_id,challenge_id,review_id,organization_id,credential_type,manifest,context_digest) values(v,s.id,c.id,r.id,o.id,p_type,manifest,digest);
 return v;end;$$;


revoke all on function public.review_assessed_submission_details(uuid,text,text,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.review_assessed_submission_details(uuid,text,text,jsonb,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
