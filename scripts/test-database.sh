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
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/credentials-database.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/wallet-database.sql

# A separate local DB proves upgrading a populated v1 schema retains its data.
docker exec "$container" createdb -U postgres proofpak_legacy_test
for sql in tests/database-bootstrap.sql supabase/migrations/202610110001_initial.sql tests/legacy-before.sql supabase/migrations/202610120001_passport_foundation.sql supabase/migrations/202610120002_organizations_credentials.sql supabase/migrations/202610120003_credential_proofs.sql supabase/migrations/202610120004_wallet_ownership.sql tests/legacy-after.sql; do
 docker exec -i "$container" psql -U postgres -d proofpak_legacy_test -v ON_ERROR_STOP=1 < "$sql"
done
