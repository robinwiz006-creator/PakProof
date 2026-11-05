-- Read-only before/after metadata and counts; never prints private notes/requests.
select name,to_regclass('public.'||name) as existing_object from unnest(array['employer_shortlists','contact_requests','visible_contact_requests']) name;
select table_name,column_name,column_default from information_schema.columns where table_schema='public' and
 ((table_name='profiles' and column_name in ('is_discoverable','allow_contact_requests')) or (table_name='achievement_sharing' and column_name='share_assessment') or table_name='visible_contact_requests') order by table_name,ordinal_position;
select to_regclass('public.achievement_sharing') is not null as sharing_present,
 to_regclass('public.challenge_assessments') is not null as assessments_present,
 to_regclass('public.credential_issuance_audit') is not null as issuer_trust_present,
 to_regclass('public.public_paid_projects') is not null as payment_privacy_present;
select 'profiles' as relation,count(*) as records from public.profiles
union all select 'projects',count(*) from public.projects
union all select 'credentials',count(*) from public.credentials
union all select 'achievements',count(*) from public.achievements
union all select 'credential_proofs',count(*) from public.credential_proofs
union all select 'blockchain_proofs',count(*) from public.blockchain_proofs;
select c.relname,c.relrowsecurity,c.reloptions,pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('employer_shortlists','contact_requests','visible_contact_requests');
select tablename,policyname,roles,qual from pg_policies where schemaname='public' and tablename in ('employer_shortlists','contact_requests');
select grantee,table_name,privilege_type from information_schema.table_privileges where table_schema='public' and table_name in ('employer_shortlists','contact_requests','visible_contact_requests') order by table_name,grantee;
select p.proname,has_function_privilege('anon',p.oid,'execute') as anon_exec,has_function_privilege('authenticated',p.oid,'execute') as authenticated_exec from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('search_passports','set_discovery_preferences','save_candidate','remove_saved_candidate','create_contact_request','respond_contact_request');
-- After migration only, uncomment to inspect consent totals without any identities:
-- select count(*) filter(where is_discoverable) as directory_opt_ins,
-- count(*) filter(where allow_contact_requests) as contact_opt_ins from public.profiles;
-- Both should be zero immediately after migration unless users subsequently opted in.
