-- Forward-only. No historical achievements, credentials or proof formats change.
begin;
create table public.challenge_rubrics (
 id uuid primary key default gen_random_uuid(),challenge_id uuid not null references public.challenges(id),
 version integer not null,criteria jsonb not null,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),unique(challenge_id,version)
);
create table public.challenge_assessments (
 review_id uuid primary key references public.submission_reviews(id),submission_id uuid not null references public.challenge_submissions(id),
 challenge_id uuid not null references public.challenges(id),rubric_id uuid references public.challenge_rubrics(id),
 criteria jsonb not null,outcomes jsonb not null,created_at timestamptz not null default now()
);
create table public.challenge_credential_sources (
 credential_id uuid primary key references public.credentials(id),submission_id uuid not null references public.challenge_submissions(id),
 challenge_id uuid not null references public.challenges(id),review_id uuid not null references public.submission_reviews(id),
 organization_id uuid not null references public.organizations(id),credential_type text not null,
 manifest jsonb not null,context_digest text not null,unique(submission_id,credential_type)
);
alter table public.challenge_rubrics enable row level security;
alter table public.challenge_assessments enable row level security;
alter table public.challenge_credential_sources enable row level security;
create policy rubric_read on public.challenge_rubrics for select to authenticated using(exists(select 1 from public.challenges c where c.id=challenge_id and public.is_company_member(c.company_id)));
create view public.challenge_public_rubrics with(security_barrier=true,security_invoker=false) as select r.id,r.challenge_id,r.version,r.criteria from public.challenge_rubrics r where exists(select 1 from public.challenges c where c.id=r.challenge_id and (c.status='published' or public.is_company_member(c.company_id)));
revoke all on public.challenge_public_rubrics from public,anon,authenticated,service_role;
grant select on public.challenge_public_rubrics to anon,authenticated,service_role;
create policy assessment_read on public.challenge_assessments for select to authenticated using(exists(select 1 from public.challenge_submissions s where s.id=submission_id and (s.talent_id=auth.uid() or exists(select 1 from public.challenges c where c.id=s.challenge_id and public.is_company_member(c.company_id)))));
create policy challenge_source_read on public.challenge_credential_sources for select to authenticated using(exists(select 1 from public.credentials c where c.id=credential_id and (c.recipient_id=auth.uid() or public.organization_member(c.organization_id))));
create trigger rubrics_immutable before update or delete on public.challenge_rubrics for each row execute function public.freeze_approved_record();
create trigger assessments_immutable before update or delete on public.challenge_assessments for each row execute function public.freeze_approved_record();
create trigger challenge_sources_immutable before update or delete on public.challenge_credential_sources for each row execute function public.freeze_approved_record();
create trigger challenge_reviews_immutable before update or delete on public.submission_reviews for each row execute function public.freeze_approved_record();
revoke all on public.challenge_rubrics,public.challenge_assessments,public.challenge_credential_sources from public,anon,authenticated,service_role;
grant select on public.challenge_rubrics to authenticated,service_role;
grant select on public.challenge_assessments,public.challenge_credential_sources to authenticated,service_role;

create function public.set_challenge_rubric(p_challenge uuid,p_criteria jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare c public.challenges;v uuid;n integer;r jsonb;begin
 select * into c from public.challenges where id=p_challenge for update;
 if c.id is null or not public.is_company_member(c.company_id) then raise exception 'Challenge owner membership required';end if;
 if p_criteria is null or jsonb_typeof(p_criteria)<>'array' then raise exception 'Provide up to six criteria';end if;
 if jsonb_array_length(p_criteria)>6 then raise exception 'Use at most six criteria';end if;
 for r in select value from jsonb_array_elements(p_criteria) loop
 if jsonb_typeof(r)<>'object' or jsonb_typeof(r->'title') is distinct from 'string' or jsonb_typeof(r->'description') is distinct from 'string' or length(trim(coalesce(r->>'title',''))) not between 3 and 100 or length(trim(coalesce(r->>'description',''))) not between 10 and 1000 then raise exception 'Each criterion needs a title and evaluation description';end if;
 end loop;
 select coalesce(max(version),0)+1 into n from public.challenge_rubrics where challenge_id=c.id;
 -- Only the documented fields are stored; arbitrary client JSON is discarded.
 insert into public.challenge_rubrics(challenge_id,version,criteria,created_by)
 values(c.id,n,coalesce((select jsonb_agg(jsonb_build_object('title',trim(x->>'title'),'description',trim(x->>'description')) order by ord) from jsonb_array_elements(p_criteria) with ordinality t(x,ord)),'[]'),auth.uid()) returning id into v;
 return v;end;$$;
create function public.create_challenge_with_rubric(p_fields jsonb,p_criteria jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare v uuid;begin
 if not public.is_company_member((p_fields->>'company_id')::uuid) then raise exception 'Company membership required';end if;
 insert into public.challenges(company_id,title,description,skills,difficulty,deadline,deliverables)
 values((p_fields->>'company_id')::uuid,p_fields->>'title',p_fields->>'description',array(select jsonb_array_elements_text(p_fields->'skills')),p_fields->>'difficulty',(p_fields->>'deadline')::date,p_fields->>'deliverables') returning id into v;
 perform public.set_challenge_rubric(v,p_criteria);return v;end;$$;
create function public.review_assessed_submission(p_submission_id uuid,p_decision text,p_feedback text,p_outcomes jsonb,p_expected_rubric uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare s public.challenge_submissions;c public.challenges;r public.challenge_rubrics;v_review uuid;v_achievement uuid;begin
 select * into s from public.challenge_submissions where id=p_submission_id for update;
 select * into c from public.challenges where id=s.challenge_id for update;
 if s.id is null or auth.uid() is null or not public.is_company_member(c.company_id) or s.talent_id=auth.uid() then raise exception 'You cannot review this submission';end if;
 if s.status<>'pending' or p_decision is null or p_decision not in ('approved','needs_improvement') or p_feedback is null or length(trim(p_feedback)) not between 10 and 3000 then raise exception 'Review pending work and give a decision and feedback';end if;
 select * into r from public.challenge_rubrics where challenge_id=c.id order by version desc limit 1;
 if r.id is distinct from p_expected_rubric then raise exception 'Assessment criteria changed. Reload and review the current version';end if;
 if p_outcomes is null or jsonb_typeof(p_outcomes)<>'array' then raise exception 'Assess each criterion';end if;
 if jsonb_array_length(p_outcomes)<>jsonb_array_length(coalesce(r.criteria,'[]')) or exists(select 1 from jsonb_array_elements(p_outcomes) x where jsonb_typeof(x)<>'string' or x#>>'{}' not in ('met','needs_improvement','not_assessed')) then raise exception 'Assess each criterion with a supported outcome';end if;
 if p_decision='approved' and exists(select 1 from jsonb_array_elements_text(p_outcomes) x where x<>'met') then raise exception 'Approval requires every defined criterion to be met';end if;
 insert into public.submission_reviews(submission_id,reviewer_id,decision,feedback) values(s.id,auth.uid(),p_decision,p_feedback) returning id into v_review;
 insert into public.challenge_assessments(review_id,submission_id,challenge_id,rubric_id,criteria,outcomes) values(v_review,s.id,c.id,r.id,coalesce(r.criteria,'[]'),p_outcomes);
 update public.challenge_submissions set status=p_decision where id=s.id;
 if p_decision='approved' then insert into public.achievements(submission_id,challenge_id,talent_id,company_id,title) values(s.id,c.id,s.talent_id,c.company_id,c.title) returning id into v_achievement;end if;
 return v_achievement;end;$$;
-- The legacy RPC cannot bypass a rubric. Rubric-free challenges retain its old use.
create or replace function public.review_submission(p_submission_id uuid,p_decision text,p_feedback text) returns uuid language plpgsql security definer set search_path='' as $$begin
 return public.review_assessed_submission(p_submission_id,p_decision,p_feedback,'[]',(select r.id from public.challenge_rubrics r join public.challenge_submissions s on s.challenge_id=r.challenge_id where s.id=p_submission_id order by r.version desc limit 1));end;$$;

create function public.issue_challenge_credential(p_submission uuid,p_organization uuid,p_title text,p_type text,p_description text,p_issue_date date,p_expiry_date date,p_award text) returns uuid language plpgsql security definer set search_path='' as $$
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

-- Always hide reviewer feedback and submitted content. Structured results require
-- additional recipient evidence consent (or private party access), not just publication.
create view public.credential_challenge_context with(security_barrier=true,security_invoker=false) as
 select s.credential_id,s.challenge_id,s.manifest->>'challenge_title' as challenge_title,s.context_digest,
 case when p.share_evidence or c.recipient_id=auth.uid() or public.organization_member(c.organization_id) then s.manifest else null end as assessment
 from public.challenge_credential_sources s join public.credentials c on c.id=s.credential_id join public.credential_preferences p on p.credential_id=c.id
 where public.visible_credential(c.id);
revoke all on public.credential_challenge_context from public,anon,authenticated,service_role;
grant select on public.credential_challenge_context to anon,authenticated,service_role;
revoke all on function public.set_challenge_rubric(uuid,jsonb),public.create_challenge_with_rubric(jsonb,jsonb),public.review_assessed_submission(uuid,text,text,jsonb,uuid),public.issue_challenge_credential(uuid,uuid,text,text,text,date,date,text) from public,anon,authenticated,service_role;
grant execute on function public.set_challenge_rubric(uuid,jsonb),public.create_challenge_with_rubric(jsonb,jsonb),public.review_assessed_submission(uuid,text,text,jsonb,uuid),public.issue_challenge_credential(uuid,uuid,text,text,text,date,date,text) to authenticated;
notify pgrst,'reload schema';
commit;
