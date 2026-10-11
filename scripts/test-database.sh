#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="proofpak-db-test-${RANDOM}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=local-test-only postgres:17-alpine >/dev/null
for attempt in {1..30}; do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database-bootstrap.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610110001_initial.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/database.sql
