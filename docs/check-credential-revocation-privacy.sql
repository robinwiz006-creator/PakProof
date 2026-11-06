-- Read-only preflight and postflight. Run as the SQL Editor database owner.
-- Counts/fingerprints only: no staff IDs, investigation text, user data or keys.
select to_regclass('public.credential_events') as existing_audit_table,
       to_regclass('public.public_credential_events') as public_status_view;
select policyname,cmd,roles,permissive,qual
from pg_policies where schemaname='public' and tablename='credential_events';
select grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name='credential_events'
and grantee in ('PUBLIC','anon','authenticated','service_role') order by grantee,privilege_type;
select has_any_column_privilege('anon','public.credential_events','SELECT') as anonymous_raw_select,
       has_table_privilege('authenticated','public.credential_events','SELECT') as authenticated_audit_select;
select column_name from information_schema.columns
where table_schema='public' and table_name='public_credential_events' order by ordinal_position;
select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.credential_events'::regclass and not tgisinternal;
select count(*) as retained_events,
 md5(coalesce(jsonb_agg(to_jsonb(e) order by id)::text,'[]')) as event_fingerprint
from public.credential_events e;
select count(*) as retained_credentials,
 md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]')) as credential_fingerprint
from public.credentials c;
select count(*) as retained_proofs,
 md5(coalesce(jsonb_agg(to_jsonb(p) order by credential_id)::text,'[]')) as proof_fingerprint
from public.credential_proofs p;
