# Task 22: Education and employment history

Based on Task 21 (`f9d620a`), preserving Tasks 19–21. The existing university profile label and qualification verification requests remain unchanged; neither provided structured employment/education history.

## Implemented

`/profile-history` provides create, edit, delete and per-record public visibility for education and employment. Open it from My Profile → Education & work experience. Records contain institution/employer, qualification/job title, optional field, date range/current flag and description. Records default to private. Public sharing also requires a published Passport. All records are explicitly self-reported; no credential or institution verification is inferred. Existing issued credentials remain separate because no authoritative relationship currently exists.

Passport sections load independently with real loading, empty, failure and refresh-retry states. Management forms show save progress, validation errors and confirmed deletion. Server actions obtain the authenticated account and constrain mutations by ownership; database RLS enforces the same boundary against direct clients.

## Migration and release

`supabase/migrations/202611100001_passport_history.sql` is forward-only, transactional and introduces one table with explicit least-privilege grants, row policies and date/length constraints. It directly depends on the initial profiles/auth schema, not on newer issuer or payment objects. Keep filename ordering after the existing pending migrations and permission patch for a coordinated release. Do not rerun it after successful application. No existing records, claims or proof formats change. No production SQL has been run.

Production migrations and backups remain paused. Until the new schema is deployed, history shows a retryable unavailable state; do not claim hosted functionality. No wallets are required. Hosted authentication/REST and real-account checks are still required before release.

## Local validation

- `npm test`: full unit suite, including four new input-validation tests.
- `bash scripts/test-passport-history.sh`: disposable PostgreSQL 17, complete local migration chain and synthetic CRUD, ownership, anonymous/unrelated-user visibility, private Passport and invalid chronology assertions. Does not use hosted credentials.
- `npm run lint`, `npm run typecheck`, `npm run format:check`.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm run test:e2e -- tests/e2e/profile-history.spec.ts tests/e2e/task21.spec.ts --workers=1`: local component/desktop/mobile checks; not hosted mutation verification.
- Browser harness runs a production build with hosted service credentials cleared. Ordinary production build is checked separately.

## Scope and limitations

Full date input is supported, rather than graduation-year-only input. Field of study is optional. Credential relationships are intentionally not guessed. No private documents, uploads, automatic acceptance/publication, payment or blockchain operations were introduced. Existing unrelated local reports/scripts are not included in this task's commit.

### Recorded results

136 unit tests passed, 0 failed, 0 skipped. One isolated database suite passed. The relevant browser rerun passed 12 tests (desktop and mobile), 0 failed, 0 skipped, without retries. The initial browser run did not reach tests: its build attempted to prerender the authenticated history route without configuration. Declaring the route dynamic corrected that error. Lint, TypeScript and formatting passed. Hosted CRUD/REST and Incognito privacy remain unverified; SQL permission tests use actual local PostgreSQL roles rather than mocked database success.
