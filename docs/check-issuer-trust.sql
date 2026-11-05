-- Read-only before/after metadata. Use only on the confirmed project.
select to_regclass('public.credential_issuance_audit') as private_audit,
 to_regclass('public.credential_issuance_provenance') as safe_provenance;
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and (table_name='organizations' and column_name='allowed_credential_types'
 or table_name='issuer_authorizations' and column_name in ('decision','previous_status','resulting_status','previous_credential_types','allowed_credential_types')
 or table_name='credential_issuance_provenance') order by table_name,ordinal_position;
select 'credentials' as relation,count(*) as records from public.credentials
union all select 'issuer_authorizations',count(*) from public.issuer_authorizations
union all select 'credential_proofs',count(*) from public.credential_proofs
union all select 'organizations',count(*) from public.organizations;
select c.relname,c.relrowsecurity,c.reloptions,pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('credential_issuance_audit','credential_issuance_provenance');
select tablename,policyname,roles,qual from pg_policies where schemaname='public'
and tablename in ('credential_issuance_audit','issuer_authorizations','credentials');
select p.proname,has_function_privilege('anon',p.oid,'execute') as anon_exec,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_exec
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('review_issuer_authorization','audit_credential_issuance','issue_credential','authorize_issuer');
select t.tgname,t.tgenabled from pg_trigger t where not t.tgisinternal
and t.tgname in ('issuance_audit_immutable','credentials_issuance_audit','issuer_authorizations_immutable');
-- AFTER only (uncomment after objects/columns above are confirmed present):
-- select issuer_status,allowed_credential_types,count(*) from public.organizations group by 1,2;
-- select decision,count(*) from public.issuer_authorizations group by 1;
-- select count(*) as new_attributed_credentials from public.credential_issuance_audit;
-- select has_table_privilege('anon','public.credential_issuance_audit','SELECT') as anon_audit_select;
-- Expected anon_audit_select=false; historical decisions NULL; no invented audit rows.
