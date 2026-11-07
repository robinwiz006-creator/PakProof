-- READ ONLY. Run before/after the new migration; retain results privately.
select name,to_regclass('public.'||name) as relation from unnest(array[
 'credentials','credential_preferences','credential_evidence','credential_proofs','credential_events',
 'credential_issuance_audit','challenge_credential_sources','public_credential_events',
 'credential_corrections','credential_correction_status']) name;
select to_regprocedure('public.correct_credential(uuid,text,text,text,date,date,text,text,text)') as correction_rpc,
 to_regprocedure('public.credential_correction_status(public.credentials)') as relationship;
select table_name,column_name from information_schema.columns where table_schema='public'
 and table_name='challenge_credential_sources' and column_name='correction_root_id';
select tablename,policyname,roles,cmd,qual from pg_policies where schemaname='public'
 and tablename in ('credential_corrections','credential_events');
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='credential_corrections';
select indexname,indexdef from pg_indexes where schemaname='public'
 and tablename in ('credential_corrections','challenge_credential_sources');
select grantee,table_name,privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name in ('credential_corrections','credential_correction_status')
 order by table_name,grantee,privilege_type;
-- Compare only in a quiet window: concurrent legitimate writes change counts/hashes.
-- The source fingerprint omits the new nullable column, which is the sole addition.
select 'credentials' as record_type,count(*) as records,md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) as fingerprint from public.credentials t
union all select 'preferences',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by credential_id)::text,'')) from public.credential_preferences t
union all select 'evidence',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by credential_id)::text,'')) from public.credential_evidence t
union all select 'proofs',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by credential_id)::text,'')) from public.credential_proofs t
union all select 'events',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from public.credential_events t
union all select 'assessment_sources',count(*),md5(coalesce(jsonb_agg(to_jsonb(t)-'correction_root_id' order by credential_id)::text,'')) from public.challenge_credential_sources t;
