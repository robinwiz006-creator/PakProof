#!/usr/bin/env bash
# Entirely disposable local database and REST API; no hosted credentials used.
set -euo pipefail
cd "$(dirname "$0")/.."
name="proofpak-privacy-$RANDOM"
cleanup() { docker rm -f "$name-api" "$name-db" >/dev/null 2>&1 || true; docker network rm "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" -e POSTGRES_PASSWORD=local-fixture-only postgres:17-alpine >/dev/null
for i in {1..30}; do if docker exec "$name-db" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
for sql in tests/database-bootstrap.sql supabase/migrations/*.sql; do
 if [[ "$sql" != *202611050001* ]]; then
  docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < "$sql" >/dev/null
 fi
done
# Seed before the forward migration and prove every seeded record is unchanged.
docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < tests/paid-project-privacy-fixtures.sql >/dev/null
fingerprint_sql="select md5(jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.paid_projects p),(select jsonb_agg(to_jsonb(m) order by id) from public.paid_milestones m),(select jsonb_agg(to_jsonb(a) order by id) from public.paid_project_applications a),(select jsonb_agg(to_jsonb(s) order by id) from public.paid_milestone_submissions s))::text)"
# Unknown hosted grants/policies must fail closed, not be silently retained.
docker exec "$name-db" psql -U postgres -v ON_ERROR_STOP=1 -c 'create role privacy_extra_reader; grant select(worker_id) on public.paid_projects to privacy_extra_reader; grant privacy_extra_reader to anon' >/dev/null
if docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050001_paid_project_public_privacy.sql >/dev/null 2>&1; then
 echo 'Migration accepted an anonymous column grant' >&2; exit 1
fi
docker exec "$name-db" psql -U postgres -v ON_ERROR_STOP=1 -c 'revoke privacy_extra_reader from anon; drop owned by privacy_extra_reader; drop role privacy_extra_reader' >/dev/null
docker exec "$name-db" psql -U postgres -v ON_ERROR_STOP=1 -c 'create policy fixture_unsafe on public.paid_projects for select to authenticated using (true)' >/dev/null
if docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050001_paid_project_public_privacy.sql >/dev/null 2>&1; then
 echo 'Migration accepted an unexpected permissive policy' >&2; exit 1
fi
docker exec "$name-db" psql -U postgres -v ON_ERROR_STOP=1 -c 'drop policy fixture_unsafe on public.paid_projects' >/dev/null
echo 'PASS: migration aborts for anonymous column grants and unexpected permissive policies'
before_hash=$(docker exec "$name-db" psql -U postgres -Atc "$fingerprint_sql")
docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611050001_paid_project_public_privacy.sql >/dev/null
after_hash=$(docker exec "$name-db" psql -U postgres -Atc "$fingerprint_sql")
[[ "$before_hash" == "$after_hash" ]] || { echo 'Migration changed existing records' >&2; exit 1; }
echo 'PASS: populated paid project migration preserves all fixture records'
docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 < tests/paid-project-privacy-grants.sql >/dev/null
# The authenticator can assume only the same API roles used by Supabase.
docker exec -i "$name-db" psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create role privacy_authenticator login password 'local-fixture-only' noinherit;
grant anon,authenticated to privacy_authenticator;
create or replace function auth.uid() returns uuid language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
 nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
SQL
docker run -d --name "$name-api" --network "$name" -p 127.0.0.1::3000 \
 -e PGRST_DB_URI="postgres://privacy_authenticator:local-fixture-only@$name-db:5432/postgres" \
 -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET=proofpak-local-test-secret-at-least-32-characters \
 postgrest/postgrest:v12.2.3 >/dev/null
port=$(docker port "$name-api" 3000/tcp | cut -d: -f2)
PRIVACY_API_URL="http://127.0.0.1:$port" node --test tests/paid-project-privacy-rest.mjs
