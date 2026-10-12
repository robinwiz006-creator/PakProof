-- READ ONLY. Expected: 11 rows, each with rls_enabled = true.
-- wallet_ownership_challenges has 0 policies intentionally (no client access); others have 1.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
 (select count(*) from pg_policy p where p.polrelid=c.oid) as policy_count
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in
 ('platform_administrators','organizations','issuer_authorizations','credentials','credential_evidence','credential_preferences','credential_events','qualification_requests','credential_proofs','wallet_ownership_challenges','wallet_connections') order by c.relname;
-- Expected: all 14 function names, privileges vary by purpose.
select p.proname,p.prosecdef as protected_function,has_function_privilege('authenticated',p.oid,'execute') as authenticated_can_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_platform_administrator','organization_member','visible_credential','protect_reviewed_organization_identity','register_organization','authorize_issuer','issue_credential','respond_credential','revoke_credential','request_qualification_verification','review_qualification_request','record_credential_proof','record_wallet_connection','disconnect_wallet') order by p.proname;
-- record_credential_proof and record_wallet_connection: authenticated=false, service=true.
-- Expected: 6 enabled triggers. Original v1/v2 tables and proofs were not rewritten.
select t.tgname,c.relname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and t.tgname in ('reviewed_organization_identity','credentials_immutable','credential_evidence_immutable','credential_events_immutable','issuer_authorizations_immutable','credential_proofs_immutable');
