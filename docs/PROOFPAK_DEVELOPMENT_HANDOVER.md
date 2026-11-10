> Task 27 partial checkpoint: resume from `task-27-solana-escrow-marketplace`, based on Task 26 `4a80325`; review target is Task 26, never main. Native Solana escrow source, SPL custody integration tests, TypeScript wire bindings and a read-only observation validator are in `programs/proofpak-escrow/README.md`. Full/incremental funding, constrained refunds and disputed-allocation resolution run in the local native test bank. **No deployed program ID, SBF binary, actual devnet transaction, escrow application UI, database settlement integration or bounty pool exists.** Existing direct payments are unchanged. No migration was added; the 24-file database chain remains paused. Next: supported SBF build and actual-binary validator tests, security review, separately authorized devnet deployment, then bind existing jointly accepted agreements/verified owner wallets and implement RPC receipt reconciliation before enabling escrow. Run `bash scripts/test-escrow-program.sh` with Docker; native tests are not deployed-program verification.

> Task 26 continuation: use `task-26-organization-teams`, based on Task 25 `cf0ecfa`. It preserves all earlier work and adds existing-membership team management, verified-email team invitations, scoped roles and append-only activity. Read `docs/TASK-26-ORGANIZATION-TEAMS.md`. New migration: `202611100004_organization_teams.sql`, after Task 25 (**24 files total; 15 after the reported nine-file production baseline**). Production remains untouched and paused. Review target is Task 25, not main.

> Task 25 continuation: latest branch is `task-25-talent-matching`, based on Task 24 `4001bbc`. Review target is `task-24-final-integration`, not main. The new migration is `202611100003_talent_evidence_matching.sql`, after Task 23: **23 files total, 14 after the reported nine-file production baseline**. See `docs/TASK-25-TALENT-MATCHING.md`. Advanced server-side evidence search, opportunity-organized shortlists and expiring opportunity invitations reuse the existing directory/contact inbox, permissions and consent. No production operations or email delivery were performed. Use this latest branch for continuation; the Task 24 inventory below remains preserved historical context.

Task 25 local evidence: implementation `3d94ddc`; 148 unit tests, 83 direct local REST tests, 40 desktop/mobile browser tests, focused SQL suites and full database/legacy chain passed. Lint, TypeScript, formatting and ordinary production build passed. See its focused report for initial failures and corrected test fixtures. Resume from `task-25-talent-matching` (not the historical Task 24 branch named below). PR comparison: https://github.com/robinwiz006-creator/PakProof/compare/task-24-final-integration...task-25-talent-matching?expand=1

Additional commands: `bash scripts/test-talent-matching.sh`; `npm run test:e2e -- tests/e2e/employer-discovery.spec.ts tests/e2e/contact-handoff.spec.ts tests/e2e/dashboard-attention.spec.ts tests/e2e/paid-lifecycle.spec.ts --workers=1`. Source and all prior preparation are preserved on this branch. Hosted testing remains blocked by the paused backup/migration release.

# ProofPak development handover — Task 24

## Start here

Latest development branch: **`task-24-final-integration`**, based on Task 23 `8332a97`. Task 24 implementation checkpoint: **`7b472b2`**, validation fixture fixes **`a94d73d`**; preservation checkpoint: **`2deb78b`**. Subsequent validation/handover commits are visible with `git log -5 --oneline`; the final remote tip is reported in the delivery message. Do not start from main and lose the stacked work.

Tasks 19 (`3b2317f`), 20 (`f89a984`, `f79c9ec`), 21 (`e709cf6`, `f9d620a`), 22 (`0dc1b69`) and 23 (`8332a97`) are ancestors. Draft PRs supplied by the owner: #10 targets main, #11 targets Task 21, #12 targets Task 22. Task 24 targets **Task 23**, never main. These branches are development work, not evidence of deployment.

## Implemented and connected

- Four pillars remain Passport, assessed work/credentials, opportunities and optional paid work.
- Task 19: strict internal authentication destinations retained through login/signup/retries/confirmation. Task 23 adds invitation destinations; Task 24 adds `/profile-history` with accurate sign-in guidance.
- Task 20: role/organization-scoped dashboard attention with partial failure handling. Task 24 retains recipient-only invitation attention even before an organization is selected; unauthorized organization requests still fail closed.
- Task 21: independent Passport errors/loading/empty states and retry; organization setup distinguishes registration, institutional identity review and category approval.
- Task 22: `/profile-history`, structured education/employment, current/ongoing dates, editing/deletion and private-by-default publication. Records are self-reported; no inferred credential verification.
- Task 23: `/credential-invitations`, approved-category preparation, review, 14-day private links, verified-email recipient identity, atomic private acceptance, decline/cancel/expiry, original issuer representative attribution and limited creation rates. **No invitation email delivery:** issuers copy/share links privately. Existing credentials/corrections/revocation/proofs remain separate.
- Task 24: history/invitation pages retain shared workspace navigation; personal history maps to My Profile and invitation review to Credentials. Invitation navigation is available in the secondary menu. Anonymous invitation links expose only a generic introduction. Legacy test chains now keep newer migrations behind prerequisites.

## Important code

- `src/lib/auth-flow.ts`, `auth-navigation.ts`, `passport.ts`: auth orchestration/redirect allowlist.
- `src/components/passport-view.tsx`, `passport-history.tsx`, `passport-credentials.tsx`, `passport-paid-work.tsx`, `passport-section-state.tsx`; `src/lib/section-result.ts`: independently loaded Passport sections.
- `src/lib/history-actions.ts`, `profile-history.ts`; `src/app/profile-history/`: history management/validation.
- `src/lib/invitation-actions.ts`, `invitations.ts`; `src/app/credential-invitations/`; `src/components/invitation-form.tsx`: invitation handoff/review.
- `src/lib/dashboard-attention.ts`, `dashboard-navigation.ts`; `src/components/portal-nav.tsx`, `workspace-frame.tsx`: attention and shared navigation.
- `supabase/migrations/`: PostgreSQL owns permission/lifecycle enforcement. Authenticated Supabase clients use RLS; a connected wallet is never sufficient proof of ownership. Existing proof/payment verifiers remain authoritative.

## Preservation inventory

Previously local-only Task 17/18 reports, diagnostics, preflight SQL, the permission patch, recovery helper and synthetic tests are committed. See `docs/PROOFPAK_FINAL_MIGRATION_PLAN.md`, `PROOFPAK_MANUAL_BACKUP_GUIDE.md`, `PROOFPAK_RECOVERY_VERIFICATION.md`, `PROOFPAK_TASK18_PRODUCT_AUDIT.md`, `PROOFPAK_TASK18_DEVELOPMENT_ROADMAP.md`, `scripts/recovery/`, `tests/recovery/` and `scripts/rehearse-legacy-upgrade.sh`. Earlier audits are historical snapshots; do not interpret their old missing-feature/test counts as current.

The previously uncommitted README, test script and REST regression changes are also preserved. All these files were reviewed for embedded credentials/private records. Synthetic fixture credentials are intentionally local-only test values, not hosted secrets.

Ignored/generated material is intentionally absent: `node_modules/`, `.next/`, `.next-e2e/`, test traces/reports, Python caches, `.env*` except the placeholder `.env.example`, and backup/output directories/archives. `.vercelignore` excludes docs, tests and recovery tooling from deployment uploads. No actual production export or user-data archive was created or committed. Store real secrets only in the owner's password manager/platform configuration; none are needed from this workspace to recover the source.

## Database release boundary — BLOCKED, paused

The owner's reported production baseline is the first nine migrations (`202610110001` through `202610120008`). Do not replay them. Fresh production state has not been checked by Task 24. Migration history was absent in the earlier diagnostic; do not invent ledger entries. Inspect actual catalogs and current data before deciding any file is outstanding.

If that baseline is reconfirmed, the exact remaining filename order is:

1. `202611050001_paid_project_public_privacy.sql`
2. `202611050002_issuer_trust.sql`
3. `202611050003_challenge_assessments.sql`
4. `202611050004_employer_discovery.sql`
5. `202611050005_paid_project_lifecycle.sql`
6. `202611060001_credential_revocation_privacy.sql`
7. `202611060002_credential_corrections.sql`
8. `202611070001_contact_handoff.sql`
9. `202611070002_organization_verification.sql`
10. `202611070003_assessment_transparency.sql`
11. `202611090001_legacy_client_permissions.sql`
12. `202611100001_passport_history.sql`
13. `202611100002_credential_invitations.sql`

There are **22 migration files total**, 13 after the reported nine-file baseline. No Task 24 schema change was added; the earlier permission patch is now preserved in Git. Task 22 directly needs profiles/Auth; Task 23 additionally needs issuer category approval, issuance audit and credential evidence/preferences. Use the full filename order for a coordinated release. The local main/legacy/rehearsal test scripts now include the history/invitation migrations at their correct points.

Automatic preview credentials/deployments were not inspected or changed in Task 24. A branch push may trigger existing automation; do not write-test such a preview until its database isolation is known. No production deployment was manually triggered and no Vercel settings were changed; automatic deployment status has not been verified.

Production backup and migration execution remain **paused**. The recovery scripts are prepared, not an existing verified production backup. Before any production operation:

1. Owner explicitly unpauses and authorizes the release procedure. Verify the existing Vercel production branch, actually serving SHA and deployment-specific Supabase environment; do not create replacement projects.
2. Obtain and successfully restore-test a complete recoverable backup through the approved manual procedure. Include Auth, schema/data/ACLs, and Storage contents if present. Keep it encrypted outside Git. The helper's local synthetic test does not establish production recoverability.
3. Refresh read-only catalog/data preflight using the preserved Task 17 diagnostic/plan. Reconcile partial applications, constraints and missing ledger honestly; never blindly replay all files or run fixtures/bootstrap SQL in hosted Supabase.
4. Coordinate matching app/database versions in a controlled maintenance window. Public paid-project and revocation privacy migrations change raw-table access, so code and database cannot be treated as independent releases. Review the detailed earlier migration plan, then each verified outstanding file's explicit transaction. Stop on the first failure; inspect rollback/schema state before resuming. Do not rerun a committed migration.
5. Validate grants/RLS/views/functions and original-data preservation. Test with separate candidate, organization member and nonmember platform-admin accounts. Then promote only the approved matching application version and verify the production domain's actual SHA and workflows.
6. On failure, stop release and use the reviewed restore/rollback plan. Reverting application code alone may be incompatible with privacy grants. No ad hoc deletion, reset, RLS disable or manual mark-paid action.

## Run locally and resume elsewhere

```bash
git clone https://github.com/robinwiz006-creator/PakProof.git
cd PakProof
git checkout task-24-final-integration
git pull --ff-only
git status --short
git log -8 --oneline
npm ci
npm run dev
```

Use Node **24.x meeting package.json's minimum**. Copy `.env.example` to `.env.local` only for an explicitly authorized development setup. Never copy production service-role credentials into a test environment. Without Supabase, local fixture routes are demonstrations, not real account workflows. Read `AGENTS.md` and the installed Next.js docs before changes. Create the next branch from this development tip and preserve all ancestors; do not reset/rebase/force-push the stack.

Environment names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `NEXT_PUBLIC_SITE_URL`, `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `CRON_SECRET`. `NEXT_PUBLIC_REOWN_PROJECT_ID` remains legacy optional configuration; do not reintroduce generic wallet selection or unsupported QR. `PROOFPAK_E2E` is local-only and must be unset on hosted environments. No new environment variables are needed by Tasks 19–24.

Email/password remains default. Wallets are optional except signing or receiving supported devnet transactions. Phantom/Solflare use supported extension or mobile in-app-browser methods. No mainnet, escrow, automatic email delivery, automatic credential publication or guaranteed payment exists.

## Validation commands and evidence

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
npm run test:db
npm run test:privacy
npm run test:upgrade
python3 -m unittest discover -s tests/recovery -p 'test_*.py'
npm run build
```

Database/REST/rehearsal commands create only disposable local Docker fixtures. Recovery unit tests also use isolated synthetic containers; they are not authorization to back up or restore production. Docker and Python 3.12+ are needed for those checks.

Relevant browser command (system Chromium in this environment; otherwise install Playwright Chromium):

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm run test:e2e -- tests/e2e/task21.spec.ts tests/e2e/profile-history.spec.ts tests/e2e/credential-invitations.spec.ts tests/e2e/auth-context.spec.ts tests/e2e/dashboard-attention.spec.ts tests/e2e/dashboard-journeys.spec.ts tests/e2e/challenge-assessment.spec.ts tests/e2e/paid-lifecycle.spec.ts tests/e2e/organization-verification.spec.ts tests/e2e/shared-navigation.spec.ts --workers=1
```

Task 24 recorded results: **144 unit tests passed**, **80 direct local REST tests passed**, **10 synthetic recovery-helper tests passed**, and the complete database script passed. The populated synthetic upgrade rehearsal passed with **16 workflow SQL suites**, verifying baseline-record preservation and ACL/RLS boundaries. The final selected browser rerun passed **84 tests** (desktop/mobile), **0 failed, 0 skipped**, without automatic retries. Initial browser startup failed on a new React test-helper type mismatch; then the first executed run passed 81/82, with one URL assertion racing Next.js client navigation. The helper and assertion timing were corrected without relaxing security checks; the full affected browser suite was rerun. Lint, TypeScript and formatting passed after fixing a related test-helper lint issue. The ordinary production build also passed with hosted service credentials cleared and local fixture mode unset. No test assertions, RLS checks or payment/proof verification rules were weakened. Browser fixtures and mocked chain data do not establish hosted Auth/RLS/email or physical-wallet compatibility. Do not run browser build and ordinary build simultaneously against the same output directory.

## Next actions and limitations

1. Review/preserve the stacked development PRs; leave main unchanged while production compatibility is blocked.
2. When the owner resumes release work, complete recoverable backup and exact schema reconciliation before authorizing migrations/deployment.
3. Run `docs/PROOFPAK_HOSTED_TESTING_GUIDE.md` with fresh labeled accounts. Add history/invitation acceptance, wrong/unconfirmed email, expiry/cancel, private/public Passport and correction/revocation checks. Real confirmation redirects and gateway behavior need hosted evidence.
4. Separately authorize real-device devnet proof/payment/recovery tests with tiny test amounts. Never infer a Paid/verified state from a submitted signature or test fixture.
5. Only after those journeys pass, consider configured invitation email delivery, further organization context continuity and targeted dependency updates. Do not add a new marketplace/chat or blockchain program merely for complexity.

GitHub API may return `Forbidden` while Git push works. Use the exact comparison URL for a PR into Task 23 if needed:
https://github.com/robinwiz006-creator/PakProof/compare/task-23-credential-invitations...task-24-final-integration?expand=1
