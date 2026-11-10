#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="proofpak-history-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-fixture-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
for sql in tests/database-bootstrap.sql supabase/migrations/*.sql tests/passport-history-database.sql; do
 docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$sql" > /dev/null
done
echo 'History database suite passed: full migration chain and synthetic ownership, CRUD, visibility and constraint assertions.'
