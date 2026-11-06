# Credential revocation privacy release

Task 9, based on `2f854a6` on `fix-wallet-specific-connection`. No hosted schema/data, environment settings or blockchain transactions were changed. This is a local release candidate.

## Confirmed cause and fields

`202610120002_organizations_credentials.sql` granted anon/authenticated SELECT on the entire `credential_events` table. Its row policy admitted anyone who could see the credential. Full-table SELECT also admitted `actor_id`; RLS did not hide columns. `credentialSelect` embedded `credential_events(*)`, so a narrow TypeScript display type did not remove extra fields from actual JSON.

Previously readable for a public accepted credential:

- `id`: internal event UUID.
- `actor_id`: revoking staff account UUID (possibly a staff member who is also an administrator).
- `credential_id`, `event_type`, `reason`, `created_at`.

The table has no separate administrator-ID, private-note or arbitrary operational-metadata column. Private issuer investigation/review notes are in `issuer_authorizations.review_note` and were not exposed through this path. The existing `reason` is a **public explanation**, not a private note field. Historical free text cannot be automatically classified as safe. If staff previously pasted confidential text into this public field, an authorized content/privacy review is still required; this migration does not rewrite or delete it.

## New boundary

Migration: `supabase/migrations/202611060001_credential_revocation_privacy.sql`.

- Fixed owner-executed `security_barrier` view `public_credential_events` exposes only `credential_id`, `event_type`, `reason`, `created_at`, gated by existing `visible_credential` consent rules and an explicit `revoked` event-type allowlist. Future private event types do not silently become public.
- Raw `credential_events` is unavailable to anon. Authenticated raw-row access is restricted to the issuing organization's members and platform administrators. Those roles retain actor attribution and the internal event ID, including for private/unpublished credentials. Existing server-only service-role rights remain intact.
- A recipient without an administrative/staff role gets their own status history through the projection, including when private, but does not get staff IDs. Unrelated authenticated users get only published, accepted history on a public Passport.
- Declining/unpublishing a credential or making the Passport private hides public history. It does not un-revoke the record. Issuer suspension remains separate from credential revocation.
- Current public explanation/date, credential issuer and warning presentation remain available. No claim fields, v1/v2/v3 serializers, evidence snapshots, proof records or existing event contents change.
- Raw writes remain denied to ordinary clients; the permission-checked revocation RPC and immutable trigger are retained.
- The shared application query uses `credential_events:public_credential_events(event_type,reason,created_at)` to preserve the existing response shape for all consumers. The revocation form explicitly labels the explanation public and warns against private investigation notes/staff details.

The view contains no `SELECT *`; future audit columns cannot silently become public. The migration aborts for a missing/non-SELECT expected read policy, unexpected permissive read policies, or inherited/custom anonymous column access rather than pretending drift is safe.

## Changes

- New forward migration and read-only `docs/check-credential-revocation-privacy.sql`.
- `src/lib/credentials.ts`: all shared credential reads use the safe relation, retaining the `credential_events` JSON property.
- `src/app/organizations/page.tsx`: public-explanation wording only.
- `scripts/test-database.sh`: applies the new migration in fresh/historical chains and adds a populated revocation upgrade/security suite with migration drift rejection checks.
- `tests/revocation-privacy-before.sql`, `tests/revocation-privacy-database.sql`: reproduce the old exposure with synthetic records, fingerprint unchanged events/claims/audits, and test the new boundary.
- `tests/paid-project-privacy-rest.mjs`: direct role-authenticated REST tests for public status, forbidden columns/filters/embeds, staff/admin audit, owner consent, denied writes and unchanged v3 claim hashes.
- `tests/revocation-privacy.test.ts`: query contract and revoked validity regression tests.

## Release prerequisites and exact order

No production migration is authorized or applied by this task.

1. Confirm the exact intended Supabase project and take a usable schema/data/Auth backup. Start with the separate test project; do not reuse production accounts or keys in test fixtures.
2. Confirm all existing migrations are applied in order: initial `202610110001`, `202610120001`–`202610120008`, then `202611050001`–`202611050005`. Apply only missing prerequisites through their reviewed release process. Never rerun the initial migration.
3. Run the read-only `docs/check-credential-revocation-privacy.sql`. Before application, the new view should be absent and the old expected SELECT policy present. Retain counts/fingerprints privately. Review unexpected policies, grants or existing objects; do not blindly rerun SQL.
4. Review the entire new migration. It changes grants/a read policy and creates one view; it performs no INSERT, UPDATE or DELETE on event/credential/proof records. Its transaction rolls back on a failed drift check. Do not remove checks to force it through.
5. **Coordinate schema and matching application release.** New code requires the new view; old code still embeds the raw audit. With only one side changed, verification can fail or unrelated signed-in users can receive an empty raw event array and incorrectly see an unrevoked state. Use an explicitly authorized maintenance/access-controlled cutover until both are in place, or separately prepare/review a staged compatibility release. Do not expose mixed versions, weaken RLS, or run part of this migration manually.
6. When separately approved, apply the complete migration once in its supplied transaction and deploy the matching reviewed commit. No new environment variables or wallet setup are required. Refresh PostgREST's schema cache if needed; the migration sends the reload notification.
7. Rerun read-only checks: anonymous raw SELECT must be false; authenticated raw SELECT remains true but RLS is staff/admin-only; public view has exactly four columns; immutable event trigger remains. Compare before/after event, credential and proof counts/fingerprints while writes are paused. Concurrent legitimate activity can otherwise change fingerprints and needs reconciliation rather than assuming corruption.
8. With separate test accounts, publish and revoke a fixture credential. Verify public warning/date/explanation/issuer and direct REST denial of `actor_id`; test an unrelated signed-in user, recipient private view, organization staff full audit and administrator full audit. Unpublish/decline/make Passport private and confirm public access disappears. Check a historical finalized proof without sending another transaction.
9. Only after preview acceptance and explicit production approval should production cutover occur. Vercel deployment status and real hosted verification remain unconfirmed here.

### Recovery

A failed migration transaction leaves the existing state intact. Do not rerun if the new view already exists without inspecting migration status. After a committed migration, do not restore the old public grants to repair an old frontend. Keep the privacy boundary and deploy matching code or a reviewed forward compatibility repair under controlled access. Never delete immutable events, rewrite claims or resend proof transactions. Existing records/signatures remain the recovery source.

## Validation scope and limitations

Tests use disposable PostgreSQL/PostgREST and synthetic role fixtures only. Legacy upgrade tests retain old v1/v3 records and proof rows, and unit fixtures cover v1/v2/v3 verification. Public API tests use the actual shared application select and verify revoked status remains authoritative after projection. No new frontend verification badge or alternative trust model is introduced.

Physical wallets, real devnet transactions, hosted Auth/accounts, hosted schema grants and Vercel deployment require later manual verification. This release fixes the event access path, not unrelated dependency advisories or already cached/publicly copied information. Public staff IDs already observed by third parties cannot be recalled by a permission change.

Exact final check results are recorded below after validation completes.

## Recorded validation results

| Check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Unit tests | 75 | 0 | 0 |
| Disposable database workflow/upgrade suites | 12 | 0 | 0 |
| Direct PostgREST security tests | 43 | 0 | 0 |
| Desktop/mobile browser tests | 152 | 0 | 0 |

Lint, TypeScript, formatting, `git diff --check` and the production build passed. The full browser suite ran with one worker on the first attempt; no retries or assertion changes were needed. Database suite counts are suite-level, not individual SQL assertion counts. The migration drift probes deliberately caused and successfully detected three rejected migration attempts in the disposable database; those are passing negative checks, not failed validations. The unmodified complete regression suites also cover issuer suspension, qualification approval, assessed credentials, historical proof formats, payments and Passport privacy.

Added coverage: two unit tests, seven direct REST tests, and one populated database upgrade/security suite with old-exposure reproduction, before/after record fingerprints, raw-column and policy checks, staff/admin/recipient access and immutable-event assertions. Existing browser tests cover revoked credential presentation and privacy fixtures; they do not establish hosted authentication or live public access.
