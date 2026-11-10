#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="proofpak-invitations-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-fixture-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
for sql in tests/database-bootstrap.sql tests/invitation-auth-bootstrap.sql supabase/migrations/*.sql tests/credential-invitations-database.sql tests/credentials-database.sql tests/issuer-trust-database.sql tests/credential-corrections-database.sql tests/assessment-transparency-database.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$sql" > /dev/null
done
echo 'Credential invitation database suite passed.'
