#!/usr/bin/env bash
# LOCAL ONLY. Never reads hosted connection variables or restores production data.
set -euo pipefail
cd "$(dirname "$0")/.."
rehearsal_db="proofpak-legacy-rehearsal-$RANDOM"
rehearsal_tmp=$(mktemp -d)
cleanup() { docker rm -f "$rehearsal_db" >/dev/null 2>&1 || true; rm -rf "$rehearsal_tmp"; }
trap cleanup EXIT
patch=supabase/migrations/202611090001_legacy_client_permissions.sql
apply() { docker exec -i "$rehearsal_db" psql -q -U postgres -d "$1" -v ON_ERROR_STOP=1 < "$2"; }
query() { docker exec "$rehearsal_db" psql -qAt -U postgres -d "$1" -v ON_ERROR_STOP=1 -c "$2"; }
expect_rejected() {
 if docker exec -i "$rehearsal_db" psql -q -U postgres -d "$1" -v ON_ERROR_STOP=1 < "$patch" > "$rehearsal_tmp/rejection.log" 2>&1; then
  echo "FAIL: patch accepted $2" >&2; exit 1
 fi
 if ! grep -q "$3" "$rehearsal_tmp/rejection.log"; then cat "$rehearsal_tmp/rejection.log" >&2; exit 1; fi
 echo "PASS: rejects $2"
}
docker run -d --name "$rehearsal_db" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
ready=false
for i in {1..30}; do if docker exec "$rehearsal_db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi; sleep 1; done
[[ "$ready" == true ]] || { echo 'Local PostgreSQL unavailable' >&2; exit 1; }
query postgres 'show server_version'
apply postgres tests/database-bootstrap.sql
apply postgres tests/supabase-legacy-defaults.sql
for sql in supabase/migrations/202610*.sql; do apply postgres "$sql"; done
# Preserve bodies/ACLs while reproducing the observed Windows SQL Editor bytes.
query postgres "do \$\$declare r record;begin for r in select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' loop execute replace(r.definition,chr(10),chr(13)||chr(10));end loop;end\$\$;" >/dev/null
apply postgres tests/legacy-permissions-baseline.sql
echo 'REHEARSAL CHECK PASSED: legacy catalog, CRLF bodies and excess grants'
expect_rejected postgres 'missing ordered prerequisites' 'Complete the reviewed prerequisite'
query postgres "select case when has_table_privilege('anon','public.profiles','TRUNCATE') then 'PASS: rejected premature patch retains original privileges atomically' else 'FAIL' end" | tee "$rehearsal_tmp/premature-check"
grep -q '^PASS:' "$rehearsal_tmp/premature-check"
echo 'REHEARSAL CHECK PASSED: prerequisite rejection and atomicity'
# Synthetic populated baseline. No production export or actual signatures are used.
query postgres 'create schema rehearsal_fixture; revoke all on schema rehearsal_fixture from public,anon,authenticated,service_role' >/dev/null
python3 - <<'PY' > "$rehearsal_tmp/issuer-fixture.sql"
from pathlib import Path
s=Path('tests/issuer-trust-legacy-before.sql').read_text().replace('public.test_issuer_baseline','rehearsal_fixture.test_issuer_baseline')
print(s)
PY
python3 - <<'PY' > "$rehearsal_tmp/achievement-fixture.sql"
from pathlib import Path
print(Path('tests/legacy-before.sql').read_text().split('create table public.test_preservation_baseline')[0])
PY
apply postgres "$rehearsal_tmp/achievement-fixture.sql"
apply postgres tests/legacy-v2-rehearsal-fixture.sql
# Existing offline payment verifier fixture, through accepted work and two receipts;
# omit its later privacy-view checks until those migrations exist. Keep transaction.
python3 - <<'PY' > "$rehearsal_tmp/payment-fixture.sql"
from pathlib import Path
s=Path('tests/payment-database.sql').read_text().split('-- Populated finalized receipts and payment references stay private after completion.')[0]
# Later cancellation RPCs do not exist in the nine-file legacy fixture. Their
# original full assertions still run in the final-schema payment suite below.
start=s.index('set local role authenticated;',s.index('Fixture historical metadata unavailable'))
end=s.index('set local role service_role;',start)
s=s[:start]+s[end:]
assert 'Offline second settlement verifier fixture' in s and s.count('begin;')>=1
print(s+'\nreset role;\ncommit;')
PY
apply postgres "$rehearsal_tmp/payment-fixture.sql"
apply postgres "$rehearsal_tmp/issuer-fixture.sql"
apply postgres tests/legacy-upgrade-preservation.sql
for sql in supabase/migrations/202611*.sql; do
 [[ "$sql" == "$patch" ]] && continue
 apply postgres "$sql"
 echo "APPLIED LOCAL: $(basename "$sql")"
done
# Capture properties which the privilege patch is forbidden to change.
query postgres "create table rehearsal_private.patch_metadata as select
 (select md5(jsonb_agg(to_jsonb(p) order by tablename,policyname)::text) from pg_policies p where schemaname='public') as policies,
 (select md5(jsonb_agg(jsonb_build_array(p.oid,p.prosrc,p.proconfig,p.proowner,p.prosecdef) order by p.oid)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as bodies,
 (select md5(jsonb_agg(to_jsonb(d) order by d.oid)::text) from pg_default_acl d) as defaults,
 (select md5(jsonb_agg(jsonb_build_array(c.oid,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('service_role',c.oid,'SELECT'),has_table_privilege('service_role',c.oid,'INSERT'),has_table_privilege('service_role',c.oid,'UPDATE'),has_table_privilege('service_role',c.oid,'DELETE')) order by c.oid)::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') as server_access" >/dev/null
apply postgres "$patch"
echo 'APPLIED LOCAL: 202611090001_legacy_client_permissions.sql'
apply postgres tests/legacy-upgrade-preservation-after.sql
echo 'REHEARSAL CHECK PASSED: populated original-record preservation'
query postgres "do \$\$declare expected rehearsal_private.patch_metadata;begin
 select * into expected from rehearsal_private.patch_metadata;
 if expected.policies is distinct from (select md5(jsonb_agg(to_jsonb(p) order by tablename,policyname)::text) from pg_policies p where schemaname='public')
 or expected.bodies is distinct from (select md5(jsonb_agg(jsonb_build_array(p.oid,p.prosrc,p.proconfig,p.proowner,p.prosecdef) order by p.oid)::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
 or expected.defaults is distinct from (select md5(jsonb_agg(to_jsonb(d) order by d.oid)::text) from pg_default_acl d)
 or expected.server_access is distinct from (select md5(jsonb_agg(jsonb_build_array(c.oid,c.relrowsecurity,c.relforcerowsecurity,has_table_privilege('service_role',c.oid,'SELECT'),has_table_privilege('service_role',c.oid,'INSERT'),has_table_privilege('service_role',c.oid,'UPDATE'),has_table_privilege('service_role',c.oid,'DELETE')) order by c.oid)::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')
 then raise exception 'Patch changed policies, bodies, defaults or server access';end if;end\$\$;" >/dev/null
echo 'REHEARSAL CHECK PASSED: policy, RLS, function body/owner/settings, default ACL and server-table access invariants'
apply postgres tests/legacy-permissions-database.sql
echo 'REHEARSAL CHECK PASSED: effective ACLs and direct denied mutations'
# Demonstrate direct column/PUBLIC leftovers are cleaned without touching defaults.
query postgres 'grant update(headline) on public.profiles to anon; grant references(id) on public.profiles to authenticated; grant all on public.skills to public' >/dev/null
apply postgres "$patch"
apply postgres tests/legacy-permissions-database.sql
echo 'REHEARSAL CHECK PASSED: explicit column and PUBLIC grants reconciled'
acl_query="select md5(jsonb_build_array((select jsonb_agg(jsonb_build_array(c.oid,c.relacl) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),(select jsonb_agg(jsonb_build_array(p.oid,p.proacl) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'))::text)"
query postgres 'create role rehearsal_extra_reader; grant update(headline) on public.profiles to rehearsal_extra_reader; grant rehearsal_extra_reader to anon' >/dev/null
before=$(query postgres "$acl_query")
expect_rejected postgres 'inherited column UPDATE' 'Unexpected inherited column-write'
[[ "$before" == "$(query postgres "$acl_query")" ]] || { echo 'Failed patch partially changed ACLs' >&2; exit 1; }
query postgres 'revoke rehearsal_extra_reader from anon; drop owned by rehearsal_extra_reader; drop role rehearsal_extra_reader' >/dev/null
echo 'REHEARSAL CHECK PASSED: inherited column grant rejection rolls back'
query postgres 'create role rehearsal_extra_truncator; grant truncate on public.skills to rehearsal_extra_truncator; grant rehearsal_extra_truncator to authenticated' >/dev/null
before=$(query postgres "$acl_query")
expect_rejected postgres 'inherited TRUNCATE' 'Unexpected inherited privilege TRUNCATE'
[[ "$before" == "$(query postgres "$acl_query")" ]] || { echo 'Failed patch partially changed ACLs' >&2; exit 1; }
query postgres 'revoke rehearsal_extra_truncator from authenticated; drop owned by rehearsal_extra_truncator; drop role rehearsal_extra_truncator' >/dev/null
echo 'REHEARSAL CHECK PASSED: inherited TRUNCATE rejection rolls back'
query postgres 'create role rehearsal_extra_executor; grant execute on function public.create_company(text,text,text,text) to rehearsal_extra_executor; grant rehearsal_extra_executor to anon' >/dev/null
before=$(query postgres "$acl_query")
expect_rejected postgres 'inherited mutation EXECUTE' 'Unexpected effective function privilege'
[[ "$before" == "$(query postgres "$acl_query")" ]] || { echo 'Failed patch partially changed ACLs' >&2; exit 1; }
echo 'REHEARSAL CHECK PASSED: inherited EXECUTE rejection rolls back'
query postgres 'revoke rehearsal_extra_executor from anon; drop owned by rehearsal_extra_executor; drop role rehearsal_extra_executor; alter table public.profiles disable row level security' >/dev/null
expect_rejected postgres 'disabled RLS' 'Expected RLS-protected'
echo 'REHEARSAL CHECK PASSED: disabled RLS rejected'
query postgres 'alter table public.profiles enable row level security' >/dev/null
apply postgres "$patch"
apply postgres tests/legacy-upgrade-preservation-after.sql
echo 'REHEARSAL CHECK PASSED: reapplication retains data and permissions'
# Validate the exact operator read-only checker against the populated result.
docker exec -i "$rehearsal_db" psql -qAt -U postgres -v ON_ERROR_STOP=1 < docs/check-legacy-client-permissions.sql > "$rehearsal_tmp/postcheck.json"
python3 - "$rehearsal_tmp/postcheck.json" <<'PYTEST'
import json,sys
x=json.load(open(sys.argv[1]));assert x['existing_table_count']==13 and x['existing_client_role_count']==2
for row in x['table_matrix']:
 assert row['rls'] and row['select'] and row['forbidden_effective_column_write_count']==0
 for key in ['insert','update','delete']: assert row[key]==row['expected_'+key]
 for key in ['truncate','references','trigger','maintain']: assert row[key] is False
assert all(r['exists'] and not r['anon'] and r['authenticated'] for r in x['rpc_execute'])
assert x['privacy_regression_check']=={'anon_paid_worker_select':False,'anon_revoking_staff_select':False,'public_paid_projection_exists':True,'public_revocation_projection_exists':True}
PYTEST
echo 'REHEARSAL CHECK PASSED: operator verification SQL matches the intended boundary'
# A second, clean local DB under the same broad defaults exercises full workflows.
docker exec "$rehearsal_db" createdb -U postgres workflow_checks
apply workflow_checks tests/database-bootstrap.sql
apply workflow_checks tests/supabase-legacy-defaults.sql
for sql in supabase/migrations/*.sql; do apply workflow_checks "$sql"; done
for sql in tests/talent-matching-database.sql tests/passport-history-database.sql tests/credential-invitations-database.sql tests/legacy-permissions-database.sql tests/assessment-transparency-database.sql tests/organization-verification-database.sql tests/contact-handoff-database.sql tests/credential-corrections-database.sql tests/paid-lifecycle-database.sql tests/paid-projects-database.sql tests/payment-database.sql tests/database.sql tests/credentials-database.sql tests/wallet-database.sql tests/issuer-trust-database.sql tests/challenge-assessments-database.sql tests/employer-discovery-database.sql; do
 apply workflow_checks "$sql"
 echo "WORKFLOW SUITE PASSED: $(basename "$sql")"
done
echo 'PASS: rehearsal complete — populated synthetic legacy upgrade plus broad-default fresh workflow database; NO hosted restore or real blockchain transaction'
