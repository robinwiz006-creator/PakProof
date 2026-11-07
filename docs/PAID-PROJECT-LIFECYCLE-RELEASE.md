# Paid-project lifecycle and recovery release

Task 7 builds on `f686d06` on `fix-wallet-specific-connection`. No hosted database, production settings, or blockchain transactions are changed by this work.

## Existing systems retained

The existing applications, immutable offers, milestone submission/review snapshots, signed wallet ownership, pinned payout authorizations, devnet token verification, unique receipts, reconciliation job, and consent-based completed-work records remain in use. Credential v1/v2/v3 claim formats and transfer verification are unchanged.

## Project rules

- Organization members can correct an unpublished, untouched draft. The editor retains every milestone ID and position and allows changes to title, scope, skills, dates, deliverables and exact integer amounts. The milestone count remains fixed for an existing draft. Budget totals and dates are validated again in SQL.
- A snapshot comparison rejects stale draft saves. Before/after draft snapshots are recorded privately for organization members; the selected worker does not gain access to unpublished draft versions.
- Terms lock on **publication**, earlier than acceptance. There is no unilateral amendment of published or accepted terms. Use a separately agreed project for changed scope.
- An organization **owner** can withdraw a published/offered opportunity or cancel a draft/published/offered project before agreement. Records, applications, offer snapshots and selected-worker access are retained; the public projection no longer advertises closed projects. An unaccepted offer cannot be accepted after closure. Applicants who were never selected may encounter an unavailable public detail page after withdrawal; notifications and public closure notices remain future work.
- After acceptance, either the selected worker or an organization owner can request cancellation with a reason. The request does **not** suspend the agreement or payments. The opposite **side** must confirm; another organization owner cannot countersign for the worker. The requester can retract, or the opposite side can decline.
- At confirmation, the database locks milestones and the project and checks current state again. Submitted work must first be reviewed; approved work must have verified receipts; every unresolved payment preparation, signed attempt, pending transfer or review-required outcome must be resolved. Unsigned preparations can be explicitly cancelled using the existing protected payment action. Cancellation never cancels a signed transfer or refunds a receipt.
- Partially paid projects can be mutually cancelled only once all currently approved obligations are settled and no submitted work or unresolved payment remains. Existing paid receipts are retained. No guarantee, waiver of outside obligations, refund or dispute resolution is implied.
- Completed projects cannot be cancelled through these controls. Only the existing server-verified all-milestone settlement path completes a project. Work approval, payment and formal credentials remain separate.

## Payment and recovery rules

The interface distinguishes awaiting work, submitted work, revisions, approval, awaiting wallet signature, signed/not yet verified, confirmation pending, verified payment, transaction failure and outcome unknown/review required. It does not infer a transfer outcome from a browser error.

A signed attempt is saved locally and registered on the server before ProofPak broadcasts. This release additionally disables a second signing action once bytes have been signed, and retains a per-milestone browser guard across refreshes. If registration fails, **Payment History → Recover saved signed payment** resubmits those original bytes to the existing server validator; this action does not broadcast. Only the original authorized payer can use it. Server validation, not browser storage, establishes authenticity.

A server-confirmed paid/failed attempt clears its local recovery guard when its recovery component is mounted. Unknown outcomes do not clear the guard or enable a replacement payment. If storage is unavailable, signing fails closed before broadcast; keep the attempt ID for diagnosis.

### Recovery instructions

1. If connection/signing is rejected before signing completes, no transaction was broadcast by ProofPak in that attempt. Retry signing the same preparation, or explicitly cancel the unsigned preparation in Payment History.
2. For an expired **unsigned** template, cancel its unsigned preparation and prepare again explicitly. No automatic financial retry is performed.
3. After refresh, open Payment History. Record the intent ID, attempt ID and original signature, if present. If bytes are only saved in that browser, use **Recover saved signed payment** first.
4. For a registered transaction, use **Check and save existing transaction**. A page/RPC timeout is not proof of failure. Never create a replacement while outcome is unknown.
5. The original owner/payer may explicitly resume **the same signed bytes** where the existing server permits it. Finalized/expired transactions cannot be resumed. This is not a new payment.
6. If the transfer finalized but database saving failed, reconcile its original signature. The existing unique receipt constraints and settlement validator prevent double credit.
7. If historical RPC data is unavailable or a locally saved attempt was invalidated before registration, retain all identifiers and stop. An operator should inspect the original transaction using a reliable archival devnet RPC and existing settlement diagnostics, then rerun the authenticated reconciliation or configured reconciliation job. Do not manually mark paid, delete locks, change receipt rows, cancel signed transfers, or issue a replacement based on absence from a single RPC response. There is deliberately no override button. Some cases require a reviewed repair outside this release.

Devnet test USDC has no monetary value. Direct payments are not escrow or guaranteed payment. Transaction details are public on Solana; app evidence and contractual information remain private to authorized parties.

## Database and release sequence (manual authorization required)

New migration: `supabase/migrations/202611050005_paid_project_lifecycle.sql`.

1. Use a separate Supabase test project first. Confirm project identity and retain a usable schema/data/auth recovery export. Do not use production user fixtures.
2. Check migration history against the existing initial migration, `202610120001`–`202610120008`, then `202611050001` paid-project privacy, `202611050002` issuer trust, `202611050003` assessments and `202611050004` discovery. Apply only missing prerequisites in chronological order after their own preflight/review. Never rerun the initial migration on an existing project.
3. Review this migration in full. It changes the project status check, adds two RLS-protected private tables and one partial unique index, replaces project/milestone term guards, and introduces two authenticated mutation RPCs. No historical rows, offer/receipt facts, public projection fields or claim formats are rewritten.
4. Run the read-only `docs/check-paid-project-lifecycle.sql` and retain its count results. Before migration the two new table references should be null and their policies/functions absent; after migration, authenticated-only execute and SELECT grants should appear, with RLS enabled and the immutable event trigger present. Before applying, check that `paid_project_events` and `paid_cancellation_requests` do not exist, that current project statuses belong to the existing five-state set, and that expected existing guard functions/policies match repository migrations. Unexpected objects or policies require review rather than blind rerun.
5. Apply the entire migration once, inside its supplied transaction. This task has **not** applied it remotely.
6. Verify both tables have RLS enabled; authenticated users have SELECT but no raw write grants; anonymous access is denied; each has a party-only read policy; event history has an immutable trigger; new RPC execute privileges exclude anon/public/service-role. Verify row counts and existing receipt signatures against the backup baseline.
7. Deploy matching application code to a preview **after** the migration. New project detail pages query these tables and require this schema. No new environment variables are required.
8. Use two separate real test accounts to exercise draft corrections, selection/acceptance, owner/worker cancellation requests, rejection of unpaid cancellation, payment rejection/recovery and consented Passport history. Do not broadcast transactions until separately authorized.
9. Only after preview acceptance should a separately authorized production migration/release be considered.

### Recovery/rollback

A failed SQL transaction rolls back as a whole. If it commits, retain the forward schema and all event/request records; do not delete cancellation history, restore old guard definitions over live new records, reset the database, or replay transfers. If a code regression occurs, pause new lifecycle operations and revert application code to a previously tested compatible release while preserving the schema. Use a reviewed forward correction for database problems. Backups are recovery safeguards, not permission to overwrite newer production records.

## Security and testing scope

Project raw-table RLS and fixed public projections from the privacy migration remain intact. Mutation RPCs independently enforce organization ownership, selected-worker identity, current state, opposite-side consent and payment obligations. Receipts remain server-only and immutable. Lifecycle reasons are shared between project parties; users should not put secrets or sensitive personal data in them.

Local SQL suites use disposable PostgreSQL; REST tests use disposable PostgREST with role JWT fixtures. Browser component fixtures are explicitly offline and unavailable when Supabase is configured. These tests do not establish hosted migration, real email authentication, physical-wallet behavior or real devnet settlement. Final counts are reported in the delivery response.

## Limitations and next task

Existing draft milestone count cannot be changed; published terms cannot be amended in place. No escrow, refunds, binding dispute process, operator mark-paid override, cancellation notifications or new public closed-opportunity page is added. Pending cancellation requests do not pause work. Browser-local recovery cannot restore bytes erased from the original browser; registered server signatures remain recoverable through the existing reconciliation process.

Next: execute the already prepared isolated preview plan with two real accounts and authorized physical-wallet devnet tests before adding further product functionality.

## Recorded local validation

- Unit tests: **73 passed, 0 failed, 0 skipped**.
- Disposable PostgreSQL workflows/upgrades: **11 suites passed, 0 failed, 0 skipped**. Includes historical v1/v3 preservation, existing v2 unit coverage, bilateral cancellation, offered withdrawal, stale edits, private draft history and unknown-payment guards.
- Disposable direct PostgREST tests: **36 passed, 0 failed, 0 skipped**. A new test initially expected 200 for a successful void RPC; corrected to the actual 204 response and reran the complete suite.
- Desktop/mobile browser suite: **152 passed, 0 failed, 0 skipped** on the final complete run. The initial overloaded run had three timeouts; the new focused lifecycle tests now allow 60 seconds, and the full rerun passed. Existing test assertions were preserved. Offline browser recovery tests intercept API requests and do not establish real wallet or chain success.
- Production build: **passed**, including compilation and static generation. Lint, TypeScript, formatting and `git diff --check`: **passed**.

No hosted database, deployed website, real email journey, physical wallet, or real devnet transfer was tested in this task.
