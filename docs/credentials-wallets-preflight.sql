-- READ ONLY. Before applying migrations 002–004, this query must return no conflicts.
-- If it returns anything, STOP: inspect the object and migration history; never rerun blindly.
with new_tables(name) as (values
 ('platform_administrators'),('organizations'),('issuer_authorizations'),('credentials'),
 ('credential_evidence'),('credential_preferences'),('credential_events'),('qualification_requests'),
 ('credential_proofs'),('wallet_ownership_challenges'),('wallet_connections'))
select 'relation' as object_type,name as object_name from new_tables where to_regclass('public.'||name) is not null
union all
select 'function',p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('is_platform_administrator','organization_member','visible_credential','protect_reviewed_organization_identity','register_organization','authorize_issuer','issue_credential','respond_credential','revoke_credential','request_qualification_verification','review_qualification_request','record_credential_proof','record_wallet_connection','disconnect_wallet')
union all
select 'trigger',t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal and t.tgname in ('reviewed_organization_identity','credentials_immutable','credential_evidence_immutable','credential_events_immutable','issuer_authorizations_immutable','credential_proofs_immutable')
union all
select 'index',c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('credentials_recipient_idx','credentials_organization_idx','qualification_requests_organization_idx','wallet_connections_active_scope','wallet_connections_active_address');

-- All three prerequisites must be true. If not, review/apply Phase 1 first.
select to_regclass('public.achievement_claims') is not null as phase1_claims_present,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='passport_previewed_at') as phase1_profile_column_present,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='blockchain_proofs' and column_name='claim_version') as phase1_proof_version_present;
