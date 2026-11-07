-- Read-only preflight/postflight; no private assessment text is printed.
select to_regclass('public.challenge_assessments') as assessments,to_regclass('public.challenge_credential_sources') as sources;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='challenge_assessments' and column_name='details';
select to_regprocedure('public.review_assessed_submission_details(uuid,text,text,jsonb,uuid,jsonb)') as detailed_review,
 to_regprocedure('public.review_assessed_submission(uuid,text,text,jsonb,uuid)') as legacy_review;
select tablename,policyname,roles,cmd,qual from pg_policies where schemaname='public' and tablename in ('challenge_assessments','challenge_credential_sources');
select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('challenge_assessments','challenge_credential_sources','credential_challenge_context') order by table_name,grantee,privilege_type;
select 'assessments' as record_type,count(*) as records,md5(coalesce(jsonb_agg(to_jsonb(t)-'details' order by review_id)::text,'')) as original_fields_fingerprint from public.challenge_assessments t
union all select 'issued_sources',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by credential_id)::text,'')) from public.challenge_credential_sources t
union all select 'credentials',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.credentials t
union all select 'proofs',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by credential_id)::text,'')) from public.credential_proofs t;
