# Task 17C — Final migration reconciliation and execution plan

**Decision: NO-GO for production execution today.** The ten-file schema gap and the function hashes are resolved well enough to plan the change. A verified restorable backup, data preflight, permission-reconciliation approval, controlled cutover/rehearsal and serving-deployment confirmation still block execution. Nothing in this document authorizes a migration, permission change or deployment.

## 1. Evidence and scope

Analysis uses the founder-supplied catalog JSON from project **`wizlluiyhsxtsxpuwudc`**, captured **7 November 2026 at 20:41:31 UTC / 8 November at 01:41:31 PKT**, and all 19 repository migration files. The source SHA-256 values embedded in the diagnostic match all 19 current files. Application source corresponds to merged PR #9 (`00fa9830e3444f35e8ed6a323fc2933a2d0e9970`); local documentation HEAD at review start is `17b3dc8`.

No new production query, migration, data/permission/Auth/Storage change, deployment, project creation or wallet transaction was performed for Task 17C. The attachment is a point-in-time catalog snapshot, not a backup or current data-integrity result. The friend's existing test session was not changed.

## 2. Reconciled database state

| Area                  | Finding                                                                                                                                                                                       | Interpretation                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First nine migrations | All structural markers present: 36 tables, 296 baseline columns, 58 functions and 31 enabled expected triggers.                                                                               | Coherent legacy foundation, not proof it supports current main or that every historical execution was recorded. **Do not rerun these files.**                 |
| Columns               | All 296 existing columns match parsed baseline types, defaults (allowing PostgreSQL's explicit literal casts) and explicitly required non-null attributes. No unexpected application columns. | No demonstrated column/type repair needed for the baseline. Table-level keys/constraints remain separately relevant.                                          |
| Policies              | All 44 baseline policy names, roles, commands and permissive modes match; predicates were reviewed against creation SQL and Phase 1's project-policy alteration.                              | No unexpected permissive policy found. Three old public read boundaries are intentionally replaced by the pending privacy migrations.                         |
| RLS                   | Enabled on all 36 existing application tables.                                                                                                                                                | RLS is not column security and does not govern TRUNCATE; this alone is not a clean permission audit.                                                          |
| Constraints/indexes   | 206 reported constraints validated; all 69 actual indexes valid/ready; expected baseline named indexes exist. Named old project-status constraint exists with the original allowed values.    | No demonstrated constraint conflict in the snapshot. This is not a fresh business-data anomaly check or complete row-content proof.                           |
| Extra objects         | No unexpected application triggers, overloads, additional public tables/views or additional public functions reported.                                                                        | No observed naming collision for the 22 new relations. Refresh just before release.                                                                           |
| Ten later files       | All their checked structural markers absent: 22 relations and 104 columns missing; 30 later function signatures absent.                                                                       | Their required effects are not installed. Some missing columns belong to absent tables; **do not add 104 columns individually**. Use complete reviewed files. |
| Migration ledger      | `supabase_migrations.schema_migrations` absent.                                                                                                                                               | Execution provenance unknown; not an instruction to reapply initial SQL or fabricate completed records.                                                       |
| Roles/schema          | `anon`/`authenticated` are not superusers or RLS-bypass roles; `service_role` bypasses RLS as expected. Clients lack CREATE on public schema.                                                 | Useful controls, but effective ACLs are broader than intended on older application tables/functions.                                                          |
| Extensions            | PostgreSQL 17.11; pgcrypto is installed in `extensions`.                                                                                                                                      | No missing-extension conflict demonstrated for the planned chain. No extension/Auth bootstrap is proposed.                                                    |

**Conclusion:** the first nine files form a structurally and functionally recognizable legacy baseline. They are **not sufficiently compatible with the whole current application** without the ten later files. There are also real privilege differences discussed below; “markers present” does not mean “fully correct.”

## 3. Function mismatches — resolved without rewriting functions

The diagnostic compared exact LF source bytes with production function-body bytes. Production copies contain Windows **CRLF** line endings.

| Comparison                                                  |  Result |
| ----------------------------------------------------------- | ------: |
| Existing functions                                          |      58 |
| Byte-for-byte source matches                                |      10 |
| Additional matches when repository LF is changed to CRLF    |      48 |
| Existing functions matching a first-nine repository version | 58 / 58 |
| Unexplained function-body differences after that comparison |       0 |

All 48 originally mismatching body hashes equal a repository baseline body with **only LF → CRLF conversion**. These baseline bodies contain no multiline single-quoted literals, so the conversion does not change a recorded multiline literal's value. Result types, language, SECURITY DEFINER flags, volatility, empty search path and owner also match the baseline metadata examined. MD5 is a code-comparison diagnostic, not a cryptographic institutional attestation or a substitute for the full permission review.

**Do not recreate or normalize production functions merely to make the raw hash green. Do not change credential hashes.** Query-time line-ending normalization is enough.

Seven existing functions are legitimately older than the final 19-file source. Their forthcoming replacements are meaningful changes, not formatting repairs:

| Function                                                       | Current known source               | Planned change                                                                                                                               |
| -------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `authorize_issuer(uuid,text,boolean,text,text,text)`           | Organizations/credentials baseline | `202611050002`: route legacy authorization through scoped, audited category decisions; legacy wrapper does not grant broad categories.       |
| `request_qualification_verification(uuid,text,text,date,text)` | Same baseline                      | `202611050002`: require appropriate academic category authority and prevent institution self-verification requests.                          |
| `review_submission(uuid,text,text)`                            | Initial                            | `202611050003`: reuse assessment workflow and prevent rubric bypass.                                                                         |
| `protect_paid_project_terms()`                                 | Paid-project baseline              | `202611050005`: controlled draft changes/cancellation while preserving accepted/payment locks.                                               |
| `protect_paid_milestone_terms()`                               | Paid-project baseline              | Same lifecycle change, preserving agreed milestone terms.                                                                                    |
| `record_credential_proof(uuid,text,text,text,timestamptz)`     | Credential-proofs baseline         | `202611060002`: reject new anchoring for accepted-superseded credentials as well as revoked/invalid ones; historical receipts remain intact. |
| `protect_reviewed_organization_identity()`                     | Organizations/credentials baseline | `202611070002`: extend identity protections to institutionally reviewed/suspended organizations.                                             |

`cancel_unsigned_payment` matches the **ninth-file** implementation, not an unexplained earlier cancellation routine. New functions introduced by the ten pending files must still be installed.

Prepared read-only verification: **`docs/PROOFPAK_FUNCTION_LINE_ENDING_CHECK.sql`**. It compares all 88 final signatures without calling them. Before release expect 30 MISSING, seven KNOWN_OLDER_BODY and 51 LATEST_BODY_MATCH results; after the complete chain expect 88 latest body matches. It normalizes CRLF only, not arbitrary whitespace or SQL logic. Re-run the full catalog diagnostic alongside it for flags, grants, result types and policies. The original raw-hash diagnostic can still show harmless mismatches after a correct Windows-editor migration.

## 4. Confirmed privacy boundaries and permission reconciliation

### A. Pending privacy fixes are genuinely needed

The catalog confirms:

- Anonymous raw SELECT and column SELECT for `paid_projects.worker_id`, `current_offer_id`, `payout_authorization_id`, and milestone operational identifiers. Old row policies permit non-draft opportunity rows.
- Anonymous raw SELECT on `credential_events.actor_id`, with the old policy allowing visible credential events.

These are **confirmed installed exposure configurations for qualifying rows**, not merely missing API cache entries. No private record was retrieved and no claim is made about the number of exposed rows or actual abuse. Pending `202611050001` and `202611060001` establish the intended safe public projections and restricted raw audit/party reads.

At the supplied snapshot their guard conditions appear compatible: exactly the expected read policies, no unexpected additional policy and no explicit column ACL. Anonymous/client roles do not inherit an extra custom reader role. Recheck immediately before execution; inherited/table privileges must be removed as the files intend, not bypassed.

### B. Ten migrations alone do not reconcile older Supabase-default ACLs

Supabase's recorded default ACLs grant broad table/function privileges to `anon` and `authenticated` when objects are created by the relevant owner. Thirteen older tables still have broad client rights, including INSERT/UPDATE/DELETE and ACL flags for **TRUNCATE, REFERENCES, TRIGGER and MAINTAIN**:

`profiles`, `companies`, `company_memberships`, `skills`, `projects`, `challenges`, `challenge_submissions`, `submission_reviews`, `achievements`, `blockchain_proofs`, `achievement_claims`, `achievement_evidence`, `achievement_sharing`.

Their ordinary row writes remain subject to RLS, which blocks many inappropriate operations. However, **TRUNCATE does not use RLS**. The standard REST table API does not expose TRUNCATE, and no anonymous SQL-execution capability or exploit was demonstrated. Nevertheless these privileges exceed least privilege and the application's explicit intended grants; they must not be dismissed as harmless or called fully reconciled.

The three old RPCs `create_company`, `submit_work` and `review_submission` also retain **explicit anon EXECUTE**, despite the initial migration revoking PUBLIC EXECUTE. Their verified bodies contain authentication/authorization guards, so this finding is not proof of anonymous creation/approval. Supabase's explicit role grants are not removed by revoking PUBLIC alone. CREATE OR REPLACE preserves existing ACLs; the ten migrations do not clean up all three legacy ACLs.

### Required separate, reviewed forward permission reconciliation

No permission changes or executable GRANT/REVOKE patch are implemented in this planning task. Before production sign-off, prepare/review/test a focused forward patch that:

1. Removes surplus client/public privileges from **only the named application tables**, then restores the repository's intended SELECT and permitted authenticated ownership/company writes. Preserve RLS and legitimate project/profile/challenge/sharing actions; do not grant direct mutation of achievements, membership, proofs or audit records.
2. Keeps the privacy-restricted raw paid/audit tables restricted after their matching migrations. Does not re-grant public raw reads or expose sensitive columns.
3. Removes unintended anonymous EXECUTE from the three legacy mutation RPCs while preserving authorized authenticated use, required server operations and trigger behavior.
4. Addresses explicit/inherited grants, not just PUBLIC. Verifies role-specific column permissions and non-row privileges. Preserves trusted server access required by existing workflows.
5. Tests newly created objects under the actual Supabase-style defaults. The new ten files generally revoke/regrant their own private tables/views explicitly, but that does not repair older objects.

Do **not** blanket-change managed Supabase default privileges, Auth/Storage schemas, or all functions/tables in `public` as an improvised fix. A scoped patch is preferable to altering platform defaults without a separate design. Its exact approved SQL and rehearsal results are an execution blocker; it is not an already-existing eleventh migration file.

## 5. Exact ten-file order

The snapshot establishes a clean structural prefix: first-nine markers present, all checked later markers absent. The following ten files are the recommended **pending schema chain**, once release conditions are met. No whole-file reapplication of the first nine is recommended.

| Order | Migration                                        | Dependencies / effect                                                                | Conflict and release notes                                                                                                                                                                                           |
| ----: | ------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|     1 | `202611050001_paid_project_public_privacy.sql`   | Existing paid model/guards; safe project/milestone views and raw-read restriction.   | Snapshot satisfies named-policy/column-ACL assumptions; recheck freshness. Coordinate with matching code because old raw public readers stop working.                                                                |
|     2 | `202611050002_issuer_trust.sql`                  | Organization/credential baseline; category scope and immutable issuance attribution. | New names/columns absent. Existing organizations receive empty explicit categories, not blanket rights. New issuance may intentionally stop until independent review. Historical credentials/proofs remain readable. |
|     3 | `202611050003_challenge_assessments.sql`         | Scoped issuer permissions; versioned rubric/review/source records.                   | New tables empty initially; no retroactive assessment invention. Legacy review wrapper changes behavior intentionally.                                                                                               |
|     4 | `202611050004_employer_discovery.sql`            | Existing Passport/sharing/credential/opportunity model.                              | New discovery/contact defaults false. Public profiles do not automatically become searchable/contactable.                                                                                                            |
|     5 | `202611050005_paid_project_lifecycle.sql`        | Existing paid agreements/payment locks.                                              | Replaces existing named project-status constraint with a superset; old validated definition matches required name. New cancellation/audit records, no agreed-term rewrite.                                           |
|     6 | `202611060001_credential_revocation_privacy.sql` | Existing credential events/visibility helper.                                        | Expected policy exists and no extra permissive/column grant observed. Requires coordinated code cutover: old raw-event readers may fail or lose visibility of revocation.                                            |
|     7 | `202611060002_credential_corrections.sql`        | Scoped issuers, assessments/source model, discovery and safe events.                 | Replaces the unique source constraint created at step 3. Keep writes paused so intermediate new source rows do not complicate uniqueness. Controlled lineage, no original claim rewrite.                             |
|     8 | `202611070001_contact_handoff.sql`               | Contact model created at step 4 plus opportunities.                                  | Replaces contact-status constraint created at step 4 with a superset. New bounded private exchange; no automatic conversion of past decisions.                                                                       |
|     9 | `202611070002_organization_verification.sql`     | Existing issuer audit/category model and prior ordered chain.                        | New trust request/audit fields; old organizations default Self-registered. No automatic identity/assessment promotion; category rights stay separate.                                                                |
|    10 | `202611070003_assessment_transparency.sql`       | Detailed assessment/source/issuer chain, after step 9.                               | Adds nullable details and final review/issuance wrappers; no fabricated legacy method/score. Existing v3 format retained.                                                                                            |

**Task 16 adds no migration.** A separately approved permission-reconciliation step is still required; its placement/order must be part of the reviewed release bundle, with final checks after both schema chain and permissions. Do not authorize this as “run ten files and everything is done.”

### Adaptation assessment

No demonstrated object-name, baseline type, function-logic, extension or known named-constraint conflict currently requires editing these ten historical files. Windows line endings do not require adaptation. The new tables/columns are absent rather than partly present in this snapshot.

The separate privilege cleanup is required because the deployed environment's default ACLs left older explicit grants in place. If a refreshed catalog differs, a restored-copy rehearsal fails, or operator data preflight finds anomalies, prepare a new reviewed forward repair rather than editing historical migrations or adding broad IF NOT EXISTS guards. The clean catalog is not proof all row-level business invariants are healthy.

## 6. Data safety and transaction risks

- The ten source files perform schema/function/permission changes and validation; no top-level seed/import or destructive record reset is intended. ALTER defaults add new metadata; they do not prove a zero-risk release. Locking, concurrent writers, timeouts and wrong-role execution remain risks.
- No existing profile/account, credential, achievement, approved evidence, agreement, payment receipt or historical Solana claim should be deleted or rewritten. New trust/category/opt-in metadata defaults are intentional and must be excluded appropriately from original-field fingerprint comparisons.
- All ten include transaction boundaries. Execute **one complete file once**, retaining its own BEGIN/COMMIT, not fragments or an editor-selected subset. A failed file ordinarily rolls back that file; earlier successfully committed files remain applied.
- Step 5's new status constraint contains all old project statuses. Steps 7/8 operate on named constraints/tables created earlier in this very chain; those objects should remain untouched until later steps finish. Do not allow intermediate application writes during the rollout.
- Do not re-run Phase 1 snapshot backfill. Missing snapshot/data anomalies must be resolved separately; marker existence alone did not check them.
- Accepted agreement terms and old receipts remain immutable. Unknown signed payments can finalize on Solana while the application is paused; a database backup or rollback does not reverse that chain event.

Prepared **`docs/PROOFPAK_MIGRATION_FINAL_PREFLIGHT.sql`** is a read-only, count-only check, **not executed against production**. It checks approved-source/snapshot/credential completeness, exact baseline counts, project statuses, authorized issuers and unresolved payment counts. These checks may scan tables; run in an agreed quiet window, retain privately and stop on missing objects/errors/nonzero integrity anomalies. Counts are not a backup or proof unchanged content. Compare original-field fingerprints using the existing targeted checks and verified backup manifest as well.

## 7. Production procedure — proposed only

### Before scheduling execution

1. Confirm the operator, exact project, migration source SHA-256s, current serving Vercel SHA, compatible application artifact and the separately reviewed permission patch. Use the existing project; do not create a replacement hosted database.
2. Agree a maintenance/testing pause with the founder and friend. An informal pause by one tester does not prevent other public users or cron jobs from writing. Identify an existing supported access-control/maintenance mechanism and get specific approval for any settings change. If no safe cutover can be enforced, remain NO-GO; do not improvise mixed old-code/new-schema exposure.
3. Inventory existing credentials, agreements, pending payments and recovery references. Do not sign, broadcast, cancel uncertain attempts or invoke the payment-reconciliation endpoint as a harmless GET. Plan how existing signed outcomes will be checked/reconciled later without a new transfer.
4. Prepare a complete recent backup and restore evidence as below. Rehearse the **exact** migration plus permission/cutover plan against an isolated recovery copy with actual defaults/customizations. No test/bootstrap/seed SQL on production. No rehearsal or migration was executed by this task.
5. Refresh the full catalog diagnostic, run the line-ending comparison and count-only data preflight. Confirm the first-nine baseline still matches, no later marker has appeared, source hashes unchanged, no unexplained body drift, and data checks pass. Resolve all unknown operational outcomes through a reviewed plan, not record deletion.
6. Obtain explicit approval naming all ten files, the concrete permission-reconciliation SQL, deployment/cutover actions, backup/restore evidence and rollback/forward-repair owner. General approval of the app or this analysis is not execution permission.

### Backup that must be proven restorable

Retain a private, encrypted, off-workspace recovery set with manifest/time/checksums covering:

- Public schema and all existing data, functions, constraints/indexes, views, RLS/grants/triggers and required roles/extensions.
- Supabase Auth users/identities and required recovery data through supported export/restore procedures. Understand CLI dump exclusions; public-only CSV/schema SQL cannot restore sign-in.
- Any used Storage objects plus bucket/object metadata separately; a PostgreSQL dump does not contain stored file bytes.
- Credentials, assessments/evidence, issuer audit, wallet/nonce state, accepted offers, milestone submissions/approvals, signed attempts, receipts, signatures and private browser recovery exports where needed.
- Current application artifact/configuration inventory, and a truthful note that the migration ledger is absent. Never put keys or password hashes into Git/chat/public evidence.

On the Free plan do not assume automatic backup/PITR. Prove supported restoration on an isolated recovery environment, not the live project, and record operator/tool versions and results. Rehearsal must account for pending chain transactions and preserve post-backup writes; merely downloading a file is not a verified recovery point.

### During the approved window

1. Enforce the approved access/write/signing/cron controls; record a final backup/preflight snapshot after writers are controlled. Do not alter Auth/Storage policies as an ad hoc migration workaround.
2. Ensure the matching reviewed application can serve after cutover. If older code is currently live, coordinate its approved deployment within the protected window; if correct code is already live, no automatic rebuild is necessary merely to add database objects.
3. Run the ten files in the table's order as the trusted migration owner, one full transaction at a time. In Supabase SQL Editor use a new query for each approved file, paste the complete reviewed source (including BEGIN/COMMIT), clear any text selection, confirm the project reference, then Run once. Save success/error/timestamps and canonical file hashes externally. After each, check created objects/guards; on any error stop before the next file.
4. Execute the separately approved scoped permission reconciliation at its rehearsed point. It is not implemented/approved by this planning task. Never re-grant public raw access or disable RLS to pass a test.
5. Run all postchecks below, confirm actual serving code/project, then perform agreed nonfinancial hosted acceptance with reserved records. Approve any real devnet transaction test separately. Do not insert fabricated verified institutions/credentials.
6. Explicit administrator category reviews and genuine institutional/assessment review remain separate operational decisions. Empty new category permissions and Self-registered trust defaults are expected; do not bulk-promote old organizations to “fix” UI warnings.
7. Resume access only after sign-off. Preserve any unresolved signed attempts for original-signature recovery and review scheduled reconciliation before re-enabling it.

## 8. Verification SQL and expected results

Use three existing/prepared read-only tools; none executes a migration:

1. `docs/PROOFPAK_PRODUCTION_DB_DIAGNOSTIC.sql` — refresh full catalogs before/after. After ten files, all 58 expected relations, 400 required columns, 88 final signatures, expected policies/triggers/indexes should exist with intended definitions/options. Missing markers should be empty; body raw hashes may still differ only because of CRLF. Review actual policies and effective ACLs, not only names.
2. `docs/PROOFPAK_FUNCTION_LINE_ENDING_CHECK.sql` — before: 58 known baseline bodies, 30 missing; after: **88 LATEST_BODY_MATCH**, no missing/older/unexplained bodies. Language, flags, results and privileges must also match the intended final definitions from the catalog.
3. `docs/PROOFPAK_MIGRATION_FINAL_PREFLIGHT.sql` — before and after in the same controlled window: integrity anomalies zero; original counts equal unless explicitly explained; pending operations accounted for. Also retain the original-field fingerprints from targeted check files such as `check-organization-verification.sql`, `check-assessment-transparency.sql`, and earlier paid/privacy/credential checks where their prerequisites exist.

Concrete final permission/privacy checks (read-only):

```sql
-- Run AFTER the planned schema/privacy changes; all three must be false.
select has_column_privilege('anon','public.paid_projects','worker_id','SELECT') as anon_worker_select,
       has_column_privilege('anon','public.paid_projects','payout_authorization_id','SELECT') as anon_payout_select,
       has_column_privilege('anon','public.credential_events','actor_id','SELECT') as anon_staff_select;

-- These public projection fields must exist, and no private operational fields appear.
select table_name,column_name
from information_schema.columns
where table_schema='public' and table_name in
 ('public_paid_projects','public_paid_milestones','public_credential_events')
order by table_name,ordinal_position;

-- After separately approved privilege reconciliation: all six must be false.
select has_table_privilege('anon','public.profiles','TRUNCATE') as anon_profile_truncate,
       has_table_privilege('authenticated','public.profiles','TRUNCATE') as user_profile_truncate,
       has_table_privilege('anon','public.achievements','INSERT') as anon_achievement_insert,
       has_table_privilege('authenticated','public.achievements','INSERT') as user_achievement_insert,
       has_function_privilege('anon','public.create_company(text,text,text,text)','EXECUTE') as anon_company_rpc,
       has_function_privilege('anon','public.review_submission(uuid,text,text)','EXECUTE') as anon_review_rpc;
```

These samples supplement, not replace, the complete effective table/column/non-row permission matrix. Explicitly permitted authenticated edits/submissions/issuer/member actions must still work; service-only proof/payment registration must remain guarded. A false denied-read result is not enough if the key/project/schema is wrong: pair it with a successful intended public/authorized read.

Run the hosted guide's consent/privacy checks in separate sessions: public profile, credentials, private evidence withdrawal, revocation/replacement status, employer shortlists/contact isolation, paid opportunity/public detail and private operational records. Do not infer physical-wallet/SMTP/cron success from SQL or local tests.

## 9. Missing migration history — truthful handling

The app does not require the Supabase CLI migration ledger to exist at runtime. Absence indicates missing execution provenance, not an empty schema.

**Recommended short-term route:** keep an owner-controlled external release manifest: source hashes, the nine-file baseline comparison, diagnostic snapshot/time, backup identity, exact ten files actually executed, operator, transaction outcome and postcheck evidence. Describe the older nine as **“baseline observed compatible; original execution dates/history unavailable”**, not “executed today by CLI.” Do not insert fake ledger records just to get a green status.

Manual SQL Editor execution may still not populate the CLI ledger. Do not run `supabase db push` against an empty history: it can attempt the initial migrations on existing objects. Do not modify or rerun historical files.

If the team later adopts CLI-managed history, make that a separately approved administrative operation using supported tooling, a reconciled baseline and accurate provenance notes. A baseline repair records a verified existing state; it must not be presented as proof the tool executed those nine files in the past. Record only actual outcomes for newly executed files, and never mark all 19 applied before executing/validating the ten. No ledger change is made or prescribed for immediate execution here.

## 10. Vercel deployment and redeployment decision

Current Vercel settings point to the confirmed project. The serving build's SHA/build-time environment still must be checked:

1. Existing Vercel project → Deployments → **Production**. Open the deployment actually assigned to `pak-proof.vercel.app`, not simply the newest successful Preview.
2. Record full SHA, deployment URL, status and domain assignment. Verify it contains reviewed current application code (`00fa983...` or a reviewed descendant containing Tasks 14–16 and earlier security/privacy work).
3. Confirm repository/Production Branch `main`. Review that deployment's build/runtime errors. Do not click Redeploy/Promote/Rollback yet.
4. Confirm values used at that build, not just today's settings. Public Supabase origin is baked into browser assets. A signed-out browser Network check can corroborate actual request hostname; record hostname only, never API/session headers. Server keys/RPC/cron configuration must be checked privately in Vercel.

**If the right code/environment is already serving:** adding the required runtime schema does not inherently require a Vercel rebuild. Refresh/recheck actual pages/API and relevant caches after PostgREST's migration notifications. Verify success; do not assume it.

**If older code is serving, or build-time public environment values changed:** deploy/redeploy the matching reviewed artifact only with explicit approval as part of the controlled cutover. New policies with old raw readers are not a safe long-term combination. A database update alone will not upgrade JavaScript/server handlers. No deployment was triggered by this task.

## 11. Failure/recovery plan

- A SQL error in a complete file normally rolls that file back. Stop and retain the sanitized error. Earlier files may already be committed; do not restart the ten-file bundle from the beginning.
- Editor/network disconnect does not prove rollback: check actual catalog/transaction outcome before retrying the same file. A rolled-back transaction is not the same as partial manual statements; investigate either case.
- Preserve the new privacy boundaries after a committed step. Do not grant raw anonymous reads or disable immutable triggers to make an old frontend work. Keep access controlled and deploy compatible code or a reviewed forward repair.
- Never delete/recreate accepted records or restore a stale backup over newer credentials/payment receipts as routine rollback. Full restoration is a separate incident approval accounting for every post-backup write and actual chain outcome.
- Database rollback cannot reverse a finalized Solana transaction. Recover original signatures/attempts, verify chain state, then reconcile; do not automatically resend or manually mark paid/verified.
- Revisit snapshot/backup immediately if another operator changes the database before the window. The uploaded diagnostic is not a lock on the current production state.

## 12. Final go/no-go checklist

| Gate                                                                  | Current status                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Exact ten-file order and dependencies identified                      | PASS                                                               |
| First-nine structure and function bodies reconciled                   | PASS, with explicit privilege caveats                              |
| Function-hash differences explained                                   | PASS: CRLF for 48; seven intentional pending semantic replacements |
| No demonstrated naming/type/known constraint conflict                 | PASS for supplied snapshot; refresh/rehearsal required             |
| Old raw paid-project/revocation privacy addressed in approved rollout | PLANNED, not executed                                              |
| Scoped inherited/default-grant reconciliation SQL reviewed/tested     | **BLOCKED — must be prepared and approved separately**             |
| Recent complete backup demonstrably restorable                        | **NOT VERIFIED — BLOCKS EXECUTION**                                |
| Fresh record-integrity/payment preflight and preservation baseline    | **NOT RUN — BLOCKS EXECUTION**                                     |
| Exact serving Vercel SHA and build-time target confirmed              | **NOT VERIFIED — BLOCKS CUTOVER APPROVAL**                         |
| Maintenance/write/signing/cron control and recovery owner agreed      | **NOT VERIFIED — BLOCKS EXECUTION**                                |
| Exact restored-copy rehearsal with Supabase-style defaults            | **NOT VERIFIED — BLOCKS EXECUTION**                                |
| Explicit approval of concrete production operations                   | **NOT GIVEN — NO EXECUTION**                                       |

**Recommendation:** approve preparation/review of the scoped permission-reconciliation patch and collect the missing backup, preflight, deployment and rehearsal evidence. Only then request approval for the exact combined production procedure. Do not rerun the first nine migrations; do not apply just the newest two; do not execute any changes yet.

## 13. Analysis limits and files

This is source/catalog analysis of the provided snapshot, not an independent security audit or a live account/wallet test. No production records were inspected to count actual exposure, no migration was rehearsed/executed in Task 17C, and no application feature/authentication/storage/permission was changed. Prior automated test results remain in Task 17 documentation and are not claimed as a fresh hosted pass.

New local planning files: this report, the read-only line-ending checker and the read-only data preflight. They remain uncommitted; no push/merge/deployment is performed. Existing Task 17B diagnostics/audit and unrelated untracked audit documents remain unchanged. Do not publish the raw attached private catalog export or recovery material to GitHub.

## Appendix A — Function comparison by actual baseline version

Only CRLF conversion was needed; no general whitespace stripping or logic substitution was used for the accepted matches. The two functions attributed to the ninth file include its final cancellation replacement.

| Actual matching repository version           | Exact LF bodies | CRLF bodies |
| -------------------------------------------- | --------------: | ----------: |
| `202610110001_initial.sql`                   |              10 |           3 |
| `202610120001_passport_foundation.sql`       |               0 |           5 |
| `202610120002_organizations_credentials.sql` |               0 |          11 |
| `202610120003_credential_proofs.sql`         |               0 |           1 |
| `202610120004_wallet_ownership.sql`          |               0 |           2 |
| `202610120005_paid_projects.sql`             |               0 |          12 |
| `202610120006_milestone_payments.sql`        |               0 |           8 |
| `202610120007_paid_work_history.sql`         |               0 |           4 |
| `202610120008_payment_workflow_guards.sql`   |               0 |           2 |

## Appendix B — Canonical pending-file SHA-256 manifest

These hashes identify repository artifacts, not a claim of past execution. Preserve the manifest with the approved release evidence; SQL Editor newline conversion is handled by the read-only function checker.

```text
c99d5fbf8f98656e964a31d9c31ae8fa7788ed237fb4c5c13c82e4b2b207d4be  202611050001_paid_project_public_privacy.sql
fea4cb7726c4c305853863f43ab299be6342f89209ec92bff5994c2a6cda7f37  202611050002_issuer_trust.sql
5511a5812d1ad6b0ea288dc83edc1839b78f9fba4dc6b6bb4c242402184e5289  202611050003_challenge_assessments.sql
1aee68fae4933cd8d9d5de65a0e66cb1ef48e55f4d3c59db2d4d242553801792  202611050004_employer_discovery.sql
bbca001b95f4b5df0ddcc7766065e315b0ebdde4ea1f2fc900dcc0374559b05e  202611050005_paid_project_lifecycle.sql
7c22b4204f896264e0f883c8af3e9e1b5cf1937a4ade675d4ec46d53efdbc2f6  202611060001_credential_revocation_privacy.sql
851a9efcf933043e0878fda3a55dd0e6a48ea89a26743a06657261ab2d300e38  202611060002_credential_corrections.sql
13a855c0c67ddaaa89a8411bc6f6a823f9bd93d99986a924a99583e78fbd346c  202611070001_contact_handoff.sql
7d6c48bef80c7e5e6d32a438ebb53b8d83bcb53e72f282c040eb1a10873761d3  202611070002_organization_verification.sql
f2c29bc135bc545bae6aca9c9dc16631bb0709827dada890ece262da806671d2  202611070003_assessment_transparency.sql
```
