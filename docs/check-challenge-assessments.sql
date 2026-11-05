-- Read-only preflight/postflight; no private records or user data selected.
select name,to_regclass('public.'||name) as existing_object from unnest(array[
 'challenge_rubrics','challenge_public_rubrics','challenge_assessments','challenge_credential_sources','credential_challenge_context']) name;
select to_regclass('public.achievement_evidence') is not null as snapshot_prerequisite,
 to_regclass('public.credential_issuance_audit') is not null as issuer_trust_prerequisite,
 to_regclass('public.public_paid_projects') is not null as privacy_prerequisite;
select 'challenges' as relation,count(*) as records from public.challenges
union all select 'challenge_submissions',count(*) from public.challenge_submissions
union all select 'submission_reviews',count(*) from public.submission_reviews
union all select 'achievements',count(*) from public.achievements
union all select 'credentials',count(*) from public.credentials
union all select 'credential_proofs',count(*) from public.credential_proofs
union all select 'blockchain_proofs',count(*) from public.blockchain_proofs;
select c.relname,c.relrowsecurity,c.reloptions,pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in
 ('challenge_rubrics','challenge_public_rubrics','challenge_assessments','challenge_credential_sources','credential_challenge_context');
select tablename,policyname,roles,qual from pg_policies where schemaname='public'
 and tablename in ('challenge_rubrics','challenge_assessments','challenge_credential_sources');
select table_name,column_name from information_schema.columns where table_schema='public'
 and table_name in ('challenge_public_rubrics','credential_challenge_context') order by table_name,ordinal_position;
select p.proname,has_function_privilege('anon',p.oid,'execute') as anon_exec,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('set_challenge_rubric','create_challenge_with_rubric','review_assessed_submission','issue_challenge_credential','review_submission');
select t.tgname,t.tgenabled from pg_trigger t where not t.tgisinternal and t.tgname in
 ('rubrics_immutable','assessments_immutable','challenge_sources_immutable','challenge_reviews_immutable');
-- After migration: new tables RLS=true; anonymous raw SELECT/execute must be false.
-- Views expose no staff IDs/reviewer notes. Raw grants are SELECT for authorized actors only.
select grantee,table_name,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('challenge_rubrics','challenge_assessments','challenge_credential_sources','credential_challenge_context','challenge_public_rubrics')
order by table_name,grantee,privilege_type;
