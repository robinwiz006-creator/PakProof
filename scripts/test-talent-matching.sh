#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="proofpak-matching-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-fixture-only postgres:17-alpine >/dev/null
ready=false
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
 sleep 1
done
[[ "$ready" == true ]] || { echo "Local PostgreSQL did not become ready" >&2; exit 1; }
for sql in tests/database-bootstrap.sql tests/invitation-auth-bootstrap.sql supabase/migrations/*.sql tests/talent-matching-database.sql tests/employer-discovery-database.sql tests/contact-handoff-database.sql tests/credential-invitations-database.sql tests/credential-corrections-database.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$sql" > /dev/null
done
echo 'Talent matching and existing discovery/contact/credential database suites passed.'
