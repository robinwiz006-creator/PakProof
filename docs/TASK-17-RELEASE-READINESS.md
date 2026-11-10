# Task 17 — Production readiness, deployment audit and documentation

**Review:** 8 November 2026, Asia/Karachi. **Branch:** `task-17-release-readiness`, created from freshly fetched `origin/main` at `00fa9830e3444f35e8ed6a323fc2933a2d0e9970` (PR #9).

## 1. Recommendation and evidence labels

**Blocked for controlled institutional pilot sign-off; ready for owner review of the documentation and hosted prerequisites.** Do not infer a deployment or migration authorization from this report. No production settings/data/schema, accounts, wallet transactions, GitHub pushes, merges or deployments were changed. Existing testing by the founder's friend was not touched.

| Label           | Meaning                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed       | Directly observed in current source, Git or narrowly scoped read-only metadata; scope is stated.                                               |
| Locally tested  | Passed here in isolated fixtures/builds; not hosted evidence.                                                                                  |
| Hosted verified | Observed on the identified serving deployment/project using the specified role. A public HTTP status alone would not prove a complete journey. |
| Not verified    | No reliable evidence for the stated hosted claim.                                                                                              |
| Blocked         | Missing access/configuration/schema evidence prevents safe progression.                                                                        |

**Confirmed release concern:** The environment-configured Supabase project `wizlluiyhsxtsxpuwudc` rejects current issuer permission/trust columns and lacks several required resources in its exposed schema cache. Latest main is incompatible with that API schema. This project's relationship to the **current serving Vercel deployment** is not confirmed here. Confirm that mapping before calling this a production incident or applying any fix. Existing friend testing must continue undisturbed until an owner-approved coordinated change window.

## 2. What is implemented versus deployed

| Item                                                       | Status / evidence                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #9 on remote main                                       | **Confirmed:** explicit `git fetch origin main:refs/remotes/origin/main` returned `00fa983...`. The default fetch refspec did not refresh `origin/main`, so it was fetched explicitly.                                                                                      |
| Task 14 issuer review                                      | **Confirmed:** `f62941e` in ancestry; private verification requests, independent administrative review, trust levels and immutable audit, separate category rights.                                                                                                         |
| Task 15 assessment transparency                            | **Confirmed:** `a09ad3a` in ancestry; optional immutable challenge assessment metadata and consented public presentation.                                                                                                                                                   |
| Task 16 lifecycle/verification                             | **Confirmed:** `50efc3a` in ancestry; separate lifecycle, consent, current trust and historical integrity; anonymous read-only status recheck.                                                                                                                              |
| Four product pillars                                       | **Confirmed source / Locally tested:** profile/project/public Passport; challenge/review/achievement and separate credentials; opportunity/employer discovery/contact; paid agreements/milestones/devnet settlement/recovery.                                               |
| Latest Vercel Production SHA/status                        | **Not verified / Blocked:** no Vercel token, authenticated connector, CLI or local `.vercel` project link available. A GitHub merge does not establish promotion.                                                                                                           |
| Existing production branch                                 | `main` is the owner-provided intended branch; **Not verified** in Vercel settings.                                                                                                                                                                                          |
| Public site availability in this environment               | **Blocked:** GETs to `https://pak-proof.vercel.app/` and public routes failed at the outbound proxy. `curl` returned `CONNECT tunnel failed, response 403` before HTTP; retry outside the sandbox produced the same result. This is not a measured website HTTP 403/outage. |
| Actual production environment / Supabase mapping           | **Not verified:** local variables are not Vercel configuration. No public assets could be inspected because of the proxy.                                                                                                                                                   |
| Hosted account, institutional, wallet and payment journeys | **Not verified:** none was executed. Local fixture signatures are not real-device approvals.                                                                                                                                                                                |

### Vercel checks the owner must perform (read only)

1. Open the **existing** Vercel project linked to `robinwiz006-creator/PakProof`. Do not import a replacement project or click Redeploy.
2. Settings → Git: record Production Branch and repository. Expected intended branch: `main`.
3. Deployments → filter **Production**. Open the deployment actually assigned to `pak-proof.vercel.app`, not just the newest Preview/Ready deployment. Record environment, deployment URL, status, Git commit, creation time and domain assignment.
4. Compare full SHA with `00fa9830e3444f35e8ed6a323fc2933a2d0e9970` (or a later reviewed main descendant). If different, record what actually serves the domain; do not promote it during this audit.
5. Inspect build/runtime logs for schema, Auth, RPC or cron errors. Retain sanitized excerpts and timestamps, not credentials/user data.
6. Settings → Environment Variables: privately confirm Production-scoped Supabase project, matching publishable/service keys, exact site origin, devnet RPCs and cron secret. Record only project reference and present/missing/matching results. Check branch overrides and whether values were present **at build time**.
7. Confirm Node 24.x meets `>=24.19.0 <25`, `npm ci`, `npm run build`, Next.js framework and repo-root settings. Check scheduled function support/status separately. Do not change settings now.
8. Send only the deployment URL/status/SHA and confirmed Supabase project reference back for review. No tokens or service keys are needed in chat.

## 3. Database observations and limits

Read-only metadata probes used the existing local service credential against `wizlluiyhsxtsxpuwudc.supabase.co`, with `GET ...?select=<known-fields>&limit=0`. No row payloads, Auth users, private evidence or counts were retrieved. No RPC was executed. Credential values were never printed. Valid base reads establish this was not simply a globally invalid API key.

| Probe                                                                     | Observed result                      | What it establishes                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles.id`, `achievement_claims.achievement_id`, `credentials.id`      | HTTP 200                             | These selected capabilities are exposed; does not certify whole migrations/policies.                                                         |
| `organizations.allowed_credential_types`                                  | HTTP 400, PostgreSQL `42703`         | Requested column absent in the queried relation. Current scoped issuance queries incompatible.                                               |
| Each of `organizations.trust_level`, `trust_suspended`, `trust_review_id` | HTTP 400, `42703`, tested separately | All three requested trust columns absent in the queried relation. Current Task 14 reads incompatible.                                        |
| `challenge_assessments` (including separate `details` probe)              | HTTP 404, `PGRST205`                 | Required relation not found in exposed PostgREST schema cache; direct SQL needed to distinguish absent relation from cache/exposure problem. |
| `organization_verification_requests`                                      | HTTP 404, `PGRST205`                 | Task 14 request resource unavailable to this API.                                                                                            |
| `contact_requests`, `contact_followups`, `credential_corrections`         | HTTP 404, `PGRST205`                 | Required discovery/handoff/correction resources unavailable in exposed cache.                                                                |
| `public_paid_projects`, `public_credential_events`                        | HTTP 404, `PGRST205`                 | New app's safe public projections unavailable. Underlying hosted privacy grants were not inspected.                                          |

**Confirmed applied migration files:** none can be certified in full from these probes. Several baseline objects exist; that is not complete migration provenance.

**Confirmed missing schema:** the four individual organization columns above are absent in the probed relation. Several required API resources are unavailable. **Confirmed wholly missing migration files:** none certified without catalog/history checks; a migration may have been partly/manual applied or the cache may be stale. **Unverified:** applied ledger, all other object definitions, function bodies, policies/grants, triggers, backups, real record counts and whether this project currently backs Production.

No SQL connection string, database credentials or Supabase management token was available. A service-role REST key does not grant arbitrary SQL/catalog access, and no SQL-execution function was invoked/created. Do not assume the project is empty; preserve all existing records as important.

## 4. Complete migration chain and release dependencies

All 19 source files are in merged main. Every file's **hosted ledger status is Not verified**, including recent files. The order below is a safe repository sequence, not an instruction to run all files on an existing database.

| Order | Filename                                         | Purpose / dependency and deployment note                                                                                                                                                                                         |
| ----: | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | `202610110001_initial.sql`                       | Base Auth signup/profile, companies, challenge/review/achievement/proof model. Never rerun on existing data.                                                                                                                     |
|     2 | `202610120001_passport_foundation.sql`           | Profile/project fields, private claim/evidence/sharing snapshots, v1/v2 compatibility. New Passport queries require objects.                                                                                                     |
|     3 | `202610120002_organizations_credentials.sql`     | Organizations, platform administrators, credentials, consent, evidence, revocation and qualification requests.                                                                                                                   |
|     4 | `202610120003_credential_proofs.sql`             | General credential v3 proof records and controlled registration.                                                                                                                                                                 |
|     5 | `202610120004_wallet_ownership.sql`              | Private nonce/signature ownership, account/purpose linkage and guarded disconnect.                                                                                                                                               |
|     6 | `202610120005_paid_projects.sql`                 | Projects, applications/offers, agreements, milestones and reviews.                                                                                                                                                               |
|     7 | `202610120006_milestone_payments.sql`            | Payment intents/attempts/receipts, pinning and protected settlement.                                                                                                                                                             |
|     8 | `202610120007_paid_work_history.sql`             | Consented completed-work Passport projection.                                                                                                                                                                                    |
|     9 | `202610120008_payment_workflow_guards.sql`       | Additional payment, attempt and wallet guards.                                                                                                                                                                                   |
|    10 | `202611050001_paid_project_public_privacy.sql`   | Safe fixed-column public project/milestone views and restricted raw SELECT. Requires paid tables/payment guards. **Coordinated cutover required:** old raw readers break after restriction; new readers fail before views exist. |
|    11 | `202611050002_issuer_trust.sql`                  | Explicit category permissions, issuance representative audit, append-only authorization history. Existing issuers receive no broad new category grant.                                                                           |
|    12 | `202611050003_challenge_assessments.sql`         | Versioned rubric/review/source snapshots, authorized linked issuance; relies on scoped issuer permissions.                                                                                                                       |
|    13 | `202611050004_employer_discovery.sql`            | Explicit discovery/contact controls, search, private shortlist/request model.                                                                                                                                                    |
|    14 | `202611050005_paid_project_lifecycle.sql`        | Safe draft updates, withdrawal/cancellation and audit; relies on agreement/payment guards.                                                                                                                                       |
|    15 | `202611060001_credential_revocation_privacy.sql` | Safe public event view and restricted raw audit; aborts unexpected permissive drift. **Coordinated cutover:** old raw event embeds can fail or hide revoked state; new reader needs projection.                                  |
|    16 | `202611060002_credential_corrections.sql`        | Immutable replacements, consent and safe lineage; uses issuer scope, assessment and discovery models.                                                                                                                            |
|    17 | `202611070001_contact_handoff.sql`               | Bounded private follow-ups and terminal contact states; needs discovery/opportunity models.                                                                                                                                      |
|    18 | `202611070002_organization_verification.sql`     | Task 14 trust columns, private requests and safe outcomes/admin queue; extends existing authorization ledger, not a second issuer system.                                                                                        |
|    19 | `202611070003_assessment_transparency.sql`       | Task 15 nullable details, detailed-review RPC and nested assessment snapshot schema; needs prior assessment/issuer chain. Old rows remain unknown, not backfilled.                                                               |

Task 16 has **no migration**. No historical v1/v2/v3 serializer is rewritten. Assessment snapshot schema 2 is nested data bound by existing v3, not a new Solana transaction version.

### Manual read-only project verification

After the owner confirms the Vercel-to-project mapping, open that project's SQL Editor, retain results privately and run only metadata queries. No test/bootstrap/fixture file belongs here.

First check ledger existence:

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
```

Only if present, inspect versions/names (not stored SQL statements):

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

Manual SQL application may not populate this ledger. Missing ledger entries alone are not permission to rerun files. Check objects independently:

```sql
select name, to_regclass('public.' || name) as relation
from unnest(array[
 'profiles','achievement_claims','organizations','issuer_authorizations',
 'credentials','credential_proofs','challenge_assessments',
 'public_paid_projects','public_paid_milestones','public_credential_events',
 'credential_corrections','credential_correction_status','employer_shortlists',
 'contact_requests','contact_followups','visible_contact_followups',
 'organization_verification_requests','organization_verification_outcomes',
 'administrator_verification_queue'
]) name;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and (
 (table_name='organizations' and column_name in
  ('allowed_credential_types','trust_level','trust_suspended','trust_review_id'))
 or (table_name='challenge_assessments' and column_name='details')
)
order by table_name,column_name;
```

Then use the existing targeted read-only checks, choosing only files whose referenced base relations exist. Some check files assume earlier schema; an error is a reason to stop, not to apply blindly:

- Baseline: `docs/check-database.sql`, `docs/check-phase-1.sql`, `docs/credentials-wallets-preflight.sql`, `docs/credentials-wallets-validation.sql`.
- Paid work: `docs/payments-preflight.sql`, `docs/payments-validation.sql`, `docs/check-paid-project-privacy.sql`, `docs/check-paid-project-lifecycle.sql`.
- Trust/assessments: `docs/check-issuer-trust.sql`, `docs/check-challenge-assessments.sql`.
- Discovery/corrections/privacy: `docs/check-employer-discovery.sql`, `docs/check-credential-revocation-privacy.sql`, `docs/check-credential-corrections.sql`, `docs/check-contact-handoff.sql`.
- Latest: `docs/check-organization-verification.sql`, `docs/check-assessment-transparency.sql`.

Retain object/RPC signatures, RLS flags, grants, policy definitions, immutable triggers and original-field count/fingerprint results. No fixed old policy count proves modern schema safety. Review intended trusted-owner fixed-column views: blindly changing them to invoker views can break the deliberate public/private boundary. A successful API query does not establish RLS correctness.

### Safe migration and recovery plan — owner authorization required

1. **Do not alter today's friend test session.** Confirm actual deployment SHA/project and inventory first; agree a later maintenance window, affected features and responsible operator.
2. Establish a recent restorable backup. On the Free plan, do not assume PITR/automatic backups. Use the supported Supabase CLI dump/backup guidance for schema and data, explicitly covering custom public objects, Auth users/identities, roles/grants/functions/triggers and migration provenance; default dump exclusions matter. Preserve storage objects separately if used. Export securely off this workspace, encrypt/access-limit it and never paste it into chat/Git. Retain CLI versions, completeness manifest and timestamps.
3. **Prove restoration** in an isolated local recovery database using the supported restore order and matching Supabase roles/extensions. Do not test restore on the live project or create a replacement hosted project as part of this task. Schema-only or public CSV export is not a complete recovery backup. Auth password data is sensitive; keep it private. A backup file merely existing is insufficient.
4. Reconcile ledger **and actual catalog** into applied/missing/drifted lists per file. Compare every existing custom policy/grant with source. Privacy migrations intentionally stop on unexpected drift. If objects partially exist or definitions differ, stop for a reviewed reconciliation migration; do not run fragments or use broad `IF NOT EXISTS` to mask inconsistency.
5. Review/rehearse the exact outstanding sequence against an isolated restored database before touching live data. Local fresh/legacy fixture tests passed, but do not reproduce every hosted extension/customization. No test fixtures may enter the real database.
6. Prepare the matching reviewed app build and a coordinated approved cutover. If privacy migrations 10/15 are outstanding, do not allow an extended old-code/new-policy or new-code/old-schema window. Pausing affected traffic/deployments is a production change requiring separate approval; this task does not do it. Latest app queries require trust columns and assessment details, so activating current main before schema readiness risks runtime errors.
7. After explicit owner approval, apply only verified outstanding complete migrations once, in filename order using their transaction boundaries and trusted migration owner. Do not wrap partial snippets, rerun initial, run seed/bootstrap fixtures or mark ledger entries blindly. If connection drops, inspect transaction outcome before retrying.
8. Run matching checks and original-field counts/fingerprints before/after in the agreed quiet window. Preserve credentials, assessment sources, Auth records, agreements, receipts and signatures. Counts/fingerprints can legitimately change during concurrent user activity; investigate instead of calling that automatic corruption.
9. Validate category permissions conservatively. Existing issuer authorization is not a broad new category grant; independent A must review only actual permitted categories. Task 14 defaults institutional trust to Self-registered; neither prior category authorization nor wallet ownership promotes it. No institution gets a trust badge via migration. Use the existing approved administrator process, not ad hoc staff impersonation.
10. Confirm matching Vercel Production deployment/domain assignment and actual SHA, then execute the hosted guide with reserved records/roles. Record HTTP/API/RLS, issuer/lifecycle/assessment/privacy and wallet evidence separately. Resume ordinary use only after explicit sign-off.

**Recovery:** a failed migration transaction normally rolls back, but a disconnected editor does not prove rollback. Once committed/new records exist, prefer a reviewed forward repair and compatible application. Do not drop columns/tables/events, restore an older database over new receipts, remove privacy policies or resend unknown transfers. An old application rollback may be incompatible with new public projections, contact terminal states or immutable snapshots; review the target version before rollback. Retain original signatures and recover/reconcile those exact attempts. A full backup restore requires a separately approved incident plan accounting for post-backup writes and independently finalized chain transactions.

## 5. Deployment and environment readiness

Repository configuration: Next.js 16.4.5, React 19.3, TypeScript, Tailwind, Supabase SSR Auth/RLS; Solana kit/web3 bridge and wallet adapters. `next.config.ts` uses `.next`, or isolated `.next-e2e` only when `PROOFPAK_E2E=1`. No `.github` workflow directory or migration/deploy build hook is present. `vercel.json` requests `/api/payments/reconcile` daily at `0 0 * * *` (Vercel cron UTC); this is not proof it is active.

| Variable                               | Local presence observed                              | Hosted check needed                                                                                               |
| -------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Present; configured project reference recorded above | Exact Production project and domain mapping.                                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Present                                              | Same project, browser-safe public key.                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`            | Present; used only for limit-zero metadata probes    | Same project, server-only; never `NEXT_PUBLIC_`.                                                                  |
| `NEXT_PUBLIC_SITE_URL`                 | Present                                              | Exact serving HTTPS origin and build-time value.                                                                  |
| `SOLANA_RPC_URL`                       | Present                                              | Server devnet genesis/reachability/provider limits.                                                               |
| `NEXT_PUBLIC_SOLANA_RPC_URL`           | Present                                              | Browser-safe devnet URL; no private provider secret.                                                              |
| `CRON_SECRET`                          | Absent locally                                       | Production presence and scheduler Authorization; absent returns 503. No production conclusion from local absence. |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`         | Present locally                                      | Optional legacy recovery only; not required for wallet-specific extension/in-app ownership flow.                  |

Do not copy local production keys into an unapproved preview. Do not change or reveal any values for this audit. App runtime needs no database password or wallet seed. Keep `PROOFPAK_E2E` unset in Vercel. Verify current provider/SDK limits and a stable host for sessions; public variables are captured at build time.

Auth manual checks: Supabase Email provider/signup/confirmation, actual SMTP delivery/rate limits, Site URL equal to the approved host, redirect allowlist including `https://<actual-host>/auth/callback` and recovery callback `.../auth/callback?purpose=recovery` (verify matcher behavior), localhost only when needed. Avoid broad wildcard production redirects. A reset email returning to the wrong host can lose the PKCE/session cookie. No Auth setting was changed or confirmation bypassed.

## 6. Security/privacy assessment

This is a focused source/local-test review, **not an independent security audit or proof of hosted policy safety**.

| Area                        | Source/local evidence                                                                                                                                   | Hosted gap / action                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport privacy            | Public/shared gates and ownership controls; explicit discovery/contact opt-ins; DB/REST tests deny private leakage.                                     | Check actual grants/projections and privacy withdrawal across public pages/search/shortlists.                                                                                                                   |
| Organization administration | Database-independent platform-admin checks and self-review prohibition; private requests/audit; Task 14 tests exercise denial and downgrade/suspension. | Confirm real administrator bootstrap, memberships, category permissions and operator identity-review procedure.                                                                                                 |
| Assessment/evidence         | Immutable snapshots and consent-filtered context; method/score/source private unless permitted. Legacy data not invented.                               | External evidence URLs have their own ACLs; never submit sensitive personal documents. Verify actual API filters don't reveal hidden values.                                                                    |
| Credential lifecycle        | Separate issuance, recipient acceptance/publication, corrections/revocation and safe event/lineage projections; historical proofs unchanged.            | Current configured API lacks safe event/correction resources. If this is serving Production, release is blocked until inspected and coordinated. No conclusion about raw current grants without catalog checks. |
| Employer discovery/handoff  | Server paging, public opt-in filters, private organization shortlists, bounded requests/notes and closure/rate limits tested.                           | Confirm real cross-company and privacy-change behavior; no email notifications/full messaging assumed.                                                                                                          |
| Paid project privacy        | Explicit public field views and party-only raw records; direct local REST rejects restricted identifiers.                                               | Safe public view absent in probed cache. Earlier raw-table permissions were a confirmed historical code vulnerability, but current hosted exposure is **not established** by these metadata probes.             |
| Payment/proof authorization | Backend origin/auth/member/wallet checks; service-only receipt/proof registration; finalized chain matching and unique receipt guard.                   | Actual service-key scoping, devnet mint/program, wallet approvals, RPCs, cron and reconciliation require hosted testing.                                                                                        |
| Recovery/cancellation       | Original signed bytes/signature retained, strict unsigned cancellation, no unknown-outcome automatic repayment; fixture tests exercise locks.           | Browser storage loss, devices, real broadcast acknowledgement loss and database-save recovery still need authorized end-to-end evidence.                                                                        |

Do not call GET `/api/payments/reconcile` as a harmless status check: it can update settlement records after reading chain results. This audit did not invoke it. `npm run doctor` reads more data than the scoped metadata checks and does not certify all recent policies; it was not used to inspect Auth users here.

### Fresh dependency audit

`npm audit --json`: **23 affected package entries: 15 high, 8 moderate, 0 critical/low**. `npm audit --omit=dev --json`: **15 high production entries, 0 moderate/critical/low**. Audits exited nonzero because findings remain; no automatic fix or dependency change was made.

The production entries propagate from two root advisories, not 15 demonstrated exploits:

- `bigint-buffer` 1.1.5, [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg), native `toBigIntLE` buffer overflow through Solana layout/wallet dependencies. App's strict payment code does not itself prove all SDK paths unreachable. Actual exploitability in this deployment is not established.
- Nested Zod 3, [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), constrained-collection memory exhaustion through Reown/Coinbase dependencies. Root application Zod 4.6.6 is patched; nested SDK copies are not thereby patched. Legacy session recovery remains part of the dependency surface even though the marketplace/unsupported QR UI is removed.
- Eight moderate development entries remain in the tooling chain; see `docs/DEPENDENCY-SECURITY-REVIEW.md` for dependency paths and prior mitigation evidence. Untrusted build inputs still matter.

Before a public/institutional pilot, assign an owner for exposure review and a targeted compatible upgrade/removal strategy, or record a time-bounded, reasoned residual-risk decision with audience restrictions. Do not claim vulnerability-free status or force overrides merely to lower counts. No new confirmed code-level exploit was demonstrated by this documentation task.

## 7. Local validation results

Run against this merged-main application, with no weakened assertions:

| Check                             |    Passed | Failed | Skipped | Scope                                                                                             |
| --------------------------------- | --------: | -----: | ------: | ------------------------------------------------------------------------------------------------- |
| `npm test`                        |       105 |      0 |       0 | Unit/offline cryptography, verification and workflow helpers.                                     |
| `npm run test:db`                 | 18 suites |      0 |       0 | Fresh 19-file chain plus populated legacy/preservation/security cases, disposable PostgreSQL.     |
| `npm run test:privacy`            |        76 |      0 |       0 | Real local PostgREST/RLS/column boundaries; additionally drift-rejection and preservation guards. |
| `npm run test:e2e -- --workers=1` |       204 |      0 |       0 | Full desktop/mobile Chromium, including 320px, explicit fixtures and auth-denial routes.          |

Browser run passed on the first full Task 17 run, with no retries. System Chromium was selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; localhost proxy bypass was set. Real hosted keys/service/cron are blanked by the browser runner. Docker was available; database suites were actually executed, not skipped or inferred from older reports.

Lint, TypeScript, formatting and production build completion are recorded in the final validation note below. Isolated local tests do not emulate hosted email, live institutional review, actual Vercel configuration or physical wallet approval. No hosted write or chain transaction was performed.

## 8. Pilot blockers and next order

| Priority / issue                               | Status                                                   | Required next action                                                                                                                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual serving commit/project unknown          | **Blocking pilot sign-off**                              | Owner supplies read-only Vercel Production SHA/domain assignment and confirmed Supabase reference.                                                                                                                                |
| Required schema/API gaps in configured project | **Confirmed there; production mapping Not verified**     | Compare catalog+ledger and cache against all 19 files. If serving deployment uses it, coordinate a separately approved backup/migration/code window. Do not apply only the two newest files if earlier prerequisites are missing. |
| Usable backup/restore not demonstrated         | **Not verified / blocking schema changes**               | Owner retains complete encrypted recovery export and isolated restore evidence before approval.                                                                                                                                   |
| Hosted end-to-end acceptance absent            | **Not verified / blocking pilot sign-off**               | Coordinate reserved accounts/time with the friend; complete the hosted guide, separating R/W/T lanes.                                                                                                                             |
| Dependency high advisories                     | **Confirmed installed / exploitability not established** | Focused exposure/remediation decision before wider pilot; tests do not waive this risk.                                                                                                                                           |
| Human issuer-review and category governance    | **Implemented; operations Not verified**                 | Independent administrator, documented identity/assessment review standards, conservative categories and private evidence handling.                                                                                                |
| SMTP/Auth redirect, cron and real RPC recovery | **Not verified**                                         | Check actual environment and approved user/physical-wallet journeys. Never test mainnet.                                                                                                                                          |

**Recommended first action:** the owner records the current Vercel Production deployment SHA and its actual Supabase project reference. In the same read-only review, run the catalog/ledger checklist. This resolves whether the observed schema gaps affect today's website and determines the exact outstanding set. Do not deploy or migrate merely because local tests are green.

Next: prove backup recovery → approve exact migration/code compatibility plan → complete coordinated cutover only when authorized → run reserved hosted account/privacy journeys → separately authorize tiny devnet proof/payment/recovery tests → review dependency/security and operational evidence → limited pilot sign-off. If no production changes are authorized, stop at documentation/evidence collection and leave the current tester undisturbed.

## 9. Documentation and release controls

Updated `README.md`; added `docs/PROOFPAK_HOSTED_TESTING_GUIDE.md` and this report. Reused Task 14/15/16 delivery reports, targeted preflight SQL, privacy/correction/contact/payment/recovery guides and dependency review instead of recreating implementations. Older `PROOFPAK_RELEASE_READINESS.md` is a historical snapshot, not this branch's current deployment assessment.

No application code, dependencies, migrations, environment files or settings are changed. The three pre-existing untracked audit documents remain untouched and must not be staged. Commit these three documentation files only; no push/merge/deploy is authorized by Task 17.

### Final validation note

`npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build` all exited 0. The production build completed successfully with the existing security checks. The three edited Markdown documents also passed a targeted Prettier check. Unit/database/REST/browser counts above are from the fresh Task 17 run; there were no failures, skips or retries in those suites. npm audit exits 1 because the documented advisories remain.

Temporary evidence logs are `/tmp/task17-{unit,db,rest,browser,lint,type,format,build}.log`, the audit JSON files, and sanitized schema-probe logs. They are workspace evidence, not publicly hosted acceptance records. Preserve a sanitized copy with the release review if needed; do not commit raw private operational logs.
