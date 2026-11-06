#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="proofpak-db-test-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-test-only postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
if [[ "$ready" != true ]]; then
 echo "PostgreSQL did not become ready on TCP port 5432" >&2
 docker logs --tail 20 "$container" >&2
 exit 1
fi
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database-bootstrap.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610110001_initial.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120001_passport_foundation.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120002_organizations_credentials.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120003_credential_proofs.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120004_wallet_ownership.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120005_paid_projects.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120006_milestone_payments.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120007_paid_work_history.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610120008_payment_workflow_guards.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050001_paid_project_public_privacy.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050002_issuer_trust.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050003_challenge_assessments.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050004_employer_discovery.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050005_paid_project_lifecycle.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_credential_revocation_privacy.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < docs/check-credential-corrections.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611060002_credential_corrections.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < docs/check-credential-corrections.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/credential-corrections-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/paid-lifecycle-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/paid-projects-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/payment-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/credentials-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/wallet-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/issuer-trust-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/challenge-assessments-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/employer-discovery-database.sql

# A separate local DB proves upgrading a populated v1 schema retains its data.
docker exec "$container" createdb -U postgres proofpak_legacy_test
for sql in tests/database-bootstrap.sql supabase/migrations/202610110001_initial.sql tests/legacy-before.sql supabase/migrations/202610120001_passport_foundation.sql supabase/migrations/202610120002_organizations_credentials.sql supabase/migrations/202610120003_credential_proofs.sql supabase/migrations/202610120004_wallet_ownership.sql supabase/migrations/202610120005_paid_projects.sql supabase/migrations/202610120006_milestone_payments.sql supabase/migrations/202610120007_paid_work_history.sql supabase/migrations/202610120008_payment_workflow_guards.sql supabase/migrations/202611050001_paid_project_public_privacy.sql supabase/migrations/202611050002_issuer_trust.sql supabase/migrations/202611050003_challenge_assessments.sql supabase/migrations/202611050004_employer_discovery.sql supabase/migrations/202611050005_paid_project_lifecycle.sql supabase/migrations/202611060001_credential_revocation_privacy.sql supabase/migrations/202611060002_credential_corrections.sql tests/legacy-after.sql; do
 docker exec -i "$container" psql -U postgres -d proofpak_legacy_test -v ON_ERROR_STOP=1 < "$sql"
done

# A populated pre-trust schema proves existing v3 claims/proofs remain unchanged.
docker exec "$container" createdb -U postgres proofpak_issuer_legacy_test
for sql in tests/database-bootstrap.sql supabase/migrations/*.sql; do
 if [[ "$sql" != *202611050002* && "$sql" != *202611050003* && "$sql" != *202611050004* && "$sql" != *202611060001* && "$sql" != *202611060002* ]]; then
  docker exec -i "$container" psql -U postgres -d proofpak_issuer_legacy_test -v ON_ERROR_STOP=1 < "$sql"
 fi
done
for sql in tests/issuer-trust-legacy-before.sql supabase/migrations/202611050002_issuer_trust.sql supabase/migrations/202611050003_challenge_assessments.sql supabase/migrations/202611050004_employer_discovery.sql supabase/migrations/202611060001_credential_revocation_privacy.sql supabase/migrations/202611060002_credential_corrections.sql tests/issuer-trust-legacy-after.sql; do
 docker exec -i "$container" psql -U postgres -d proofpak_issuer_legacy_test -v ON_ERROR_STOP=1 < "$sql"
done

# Preserve a populated revoked credential and private audit through the boundary.
docker exec "$container" createdb -U postgres proofpak_revocation_test
for sql in tests/database-bootstrap.sql supabase/migrations/*.sql; do
 if [[ "$sql" != *202611060001* && "$sql" != *202611060002* ]]; then
  docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < "$sql"
 fi
done
docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < tests/revocation-privacy-before.sql
# Migration drift must fail closed, including inherited column grants.
docker exec "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 -c 'create role revocation_extra_reader; grant select(actor_id) on public.credential_events to revocation_extra_reader; grant revocation_extra_reader to anon' >/dev/null
if docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_credential_revocation_privacy.sql >/dev/null 2>&1; then
 echo 'Revocation migration retained inherited anonymous column access' >&2; exit 1
fi
docker exec "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 -c 'revoke revocation_extra_reader from anon; drop owned by revocation_extra_reader; drop role revocation_extra_reader; create policy fixture_revocation_drift on public.credential_events for select to authenticated using (true)' >/dev/null
if docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_credential_revocation_privacy.sql >/dev/null 2>&1; then
 echo 'Revocation migration accepted an unexpected permissive policy' >&2; exit 1
fi
docker exec "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 -c 'drop policy fixture_revocation_drift on public.credential_events' >/dev/null
docker exec "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 -c 'drop policy credential_events_read on public.credential_events; create policy credential_events_read on public.credential_events for all using(public.visible_credential(credential_id))' >/dev/null
if docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_credential_revocation_privacy.sql >/dev/null 2>&1; then
 echo 'Revocation migration accepted a drifted non-SELECT baseline policy' >&2; exit 1
fi
docker exec "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 -c 'drop policy credential_events_read on public.credential_events; create policy credential_events_read on public.credential_events for select using(public.visible_credential(credential_id))' >/dev/null
for sql in supabase/migrations/202611060001_credential_revocation_privacy.sql supabase/migrations/202611060002_credential_corrections.sql tests/revocation-privacy-database.sql; do
 docker exec -i "$container" psql -U postgres -d proofpak_revocation_test -v ON_ERROR_STOP=1 < "$sql"
done
