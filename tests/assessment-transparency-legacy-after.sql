do $$begin
 if (select jsonb_agg(to_jsonb(a)-'details' order by review_id) from public.challenge_assessments a) is distinct from (select assessments from test_assessment_legacy) then raise exception 'Historical assessment fields changed';end if;
 if exists(select 1 from public.challenge_assessments where details is not null) then raise exception 'Historical method/score inferred';end if;
 if (select jsonb_agg(to_jsonb(s) order by credential_id) from public.challenge_credential_sources s) is distinct from (select sources from test_assessment_legacy) then raise exception 'Legacy source manifest or digest changed';end if;
 if (select jsonb_agg(to_jsonb(c) order by id) from public.credentials c) is distinct from (select credentials from test_assessment_legacy) then raise exception 'Legacy credential facts changed';end if;
 if exists(select 1 from public.challenge_credential_sources where manifest->>'schema'<>'1' or manifest ?| array['details','context_salt'] or encode(sha256(convert_to(manifest::text,'UTF8')),'hex')<>context_digest) then raise exception 'Legacy assessment hash incompatible';end if;
end$$;
begin;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000011';
select id as credential from public.credentials limit 1 \gset
select set_config('test.assessment_legacy_credential',:'credential',true);
do $$begin
 begin update public.challenge_assessments set details='{}';raise exception 'Historical assessment editable';exception when insufficient_privilege then null;end;
end$$;
select public.correct_credential(:'credential','Correct the title while retaining historical assessment commitments.','Corrected legacy assessment','A corrected certificate referencing the original assessed work.',current_date,null,(select program_name from public.credentials where id=:'credential'),'',(select evidence_url from public.credential_evidence where credential_id=:'credential')) as replacement \gset
select set_config('test.assessment_legacy_replacement',:'replacement',true);
do $$begin
 if (select manifest from public.challenge_credential_sources where credential_id=current_setting('test.assessment_legacy_replacement')::uuid) is distinct from (select manifest from public.challenge_credential_sources where credential_id=current_setting('test.assessment_legacy_credential')::uuid) then raise exception 'Correction rewrote legacy assessment schema';end if;
end$$;
rollback;
\echo 'PASS: populated schema-1 assessments, source digests, credential facts and correction commitments unchanged; no historical metadata inferred'
