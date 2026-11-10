# ProofPak development handover

**Updated:** 10 November 2026 (Asia/Karachi). This is a continuation guide, not a new audit.

## 1. Resume from this branch

Repository: `robinwiz006-creator/PakProof`.

| Work    | Local branch / commit                                      | What changed                                                                                                                |
| ------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Task 19 | `task-19-opportunity-auth-context` / `3b2317f`             | Safe challenge/project return paths across login, signup, retries, confirmation and header links; no automatic actions.     |
| Task 20 | `task-20-dashboard-pending-actions` / `f89a984`, `f79c9ec` | Role-scoped dashboard attention summaries, partial failure/retry states and lean count queries.                             |
| Task 21 | `task-21-passport-organization-handover` / **`e709cf6`**   | Independent Passport section failures/loading/retry; compact organization setup guidance and resilient verification panels. |

Task 21 includes Tasks 19 and 20. The latest documentation commit follows the implementation commit above. Git transport works in this environment; `gh auth status` reports the injected `GH_TOKEN` invalid, and GitHub API requests return `Forbidden`. Do not paste credentials into chat. The final delivery states the PR result and latest pushed SHA.

```bash
git fetch origin
git switch task-21-passport-organization-handover
git pull --ff-only origin task-21-passport-organization-handover
git log -6 --oneline
git merge-base --is-ancestor 3b2317f HEAD
git merge-base --is-ancestor f79c9ec HEAD
```

On a fresh clone, use `git switch --track origin/task-21-passport-organization-handover`. Do not resume from an older main checkout and accidentally omit these tasks. Do not reset or clean an existing dirty workspace.

## 2. Implementation pointers

- **Passport:** `src/lib/section-result.ts` safely distinguishes loaded, empty and unavailable responses; provider errors stay private. `src/lib/data.ts` preserves successful project/achievement reads when a sibling fails. `src/components/passport-view.tsx` streams credentials and completed work through independent Suspense boundaries. `passport-credentials.tsx`, `passport-paid-work.tsx`, `passport-section-state.tsx` and `src/app/talent/[slug]/loading.tsx` give truthful feedback. Retry reuses `attention-retry.tsx` and real route refresh. Empty public messages reveal no hidden record existence.
- **Private preview:** `src/app/portal/[...section]/page.tsx` carries section failures into the preview rather than aborting the page for optional project/achievement query errors. Identity/authentication failures remain blocking. Existing RLS, consent and proof formats are unchanged.
- **Organization setup:** `src/lib/organization-onboarding.ts`, `src/components/organization-onboarding.tsx` and `/organizations` separate registration, institutional verification and category permissions. Opportunity management remains available without issuer approval. Issuance links require actual authorized categories. Missing legacy metadata is shown as unavailable, not treated as approval. Verification forms/history are collapsed and failures do not destroy the overview. Registration success wording in `credential-actions.ts` now reflects the separate approvals.
- **Attention:** `src/lib/dashboard-attention.ts`, `dashboard-attention-data.tsx`, `dashboard-attention.tsx`; own-company self-review excluded, counts scoped to the signed-in actor/context.
- **Authentication:** `src/lib/auth-navigation.ts`, `auth-flow.ts`, `/auth/callback`, login/signup/resend pages. Allowlist permits canonical challenge/project routes only. Password recovery retains priority.

No new database schema, notifications, wallet, settlement or blockchain behavior was introduced in Tasks 19–21.

## 3. Deployed versus implemented

The code above is implemented and locally tested. **Hosted deployment, live sessions, actual saved records and physical wallets have not been validated by these tasks.** Remote main was observed at `00fa9830e3444f35e8ed6a323fc2933a2d0e9970`; that observation is not proof of Vercel's serving SHA.

**Do not merge this release into production yet.** The owner confirms ten later application migrations plus the permission patch remain unapplied. Current selectors still depend on resources such as `public_paid_projects`, `public_credential_events`, `credential_issuance_provenance`, `credential_challenge_context`, `credential_correction_status`, `visible_contact_requests` and organization trust/category fields. Task 21 improves failure handling but does not make every existing route compatible with the legacy schema.

Vercel may deploy `main` automatically. `vercel.json` schedules payment reconciliation; no GitHub Actions directory or automatic migration script was found. Current Vercel project settings/serving SHA were not independently verified here. No deployment, setting change or merge was performed.

## 4. Paused database/recovery work and local files

Do not resume without separate explicit authorization. Reuse:

- `docs/PROOFPAK_FINAL_MIGRATION_PLAN.md`, `PROOFPAK_MIGRATION_FINAL_PREFLIGHT.sql`.
- `docs/TASK-17D-PERMISSION-REHEARSAL.md`, `TASK-17D-PRODUCTION-CHECKLIST.md`.
- `docs/PROOFPAK_MANUAL_BACKUP_GUIDE.md`, `PROOFPAK_RECOVERY_VERIFICATION.md`.
- `scripts/recovery/`, `scripts/rehearse-legacy-upgrade.sh`, related synthetic tests.
- Prepared, unapplied `supabase/migrations/202611090001_legacy_client_permissions.sql`.

**Important:** much of that material is untracked local work and intentionally excluded from this release branch's commits. Task 18's `PROOFPAK_TASK18_PRODUCT_AUDIT.md` and `PROOFPAK_TASK18_DEVELOPMENT_ROADMAP.md` are also local/untracked. Modified `README.md`, `package.json`, two database test scripts and `tests/paid-project-privacy-rest.mjs` contain earlier local work and remain untouched/uncommitted. Run `git status --short` before changing anything. A fresh clone will not contain untracked files. The owner must retain those reviewed source/documents privately before discarding the workspace; do not blindly `git add -A` or publish recovery material.

No production backup was created or proven recoverable. Prior synthetic rehearsals are not production recovery evidence. No migration, backup or restore was performed in Task 21.

## 5. Local setup and validation

Use Node **24.19 or later within Node 24** and the repository lockfile:

```bash
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
```

A developer can browse the clearly labeled demo without Supabase. For real accounts, provision authorized configuration privately; never copy production service credentials into a test environment. The app remains Next.js/Supabase with Solana devnet only.

Focused checks:

```bash
node --import tsx --test tests/task21.test.ts
npm run test:e2e -- tests/e2e/task21.spec.ts tests/e2e/demo.spec.ts tests/e2e/dashboard-journeys.spec.ts tests/e2e/organization-verification.spec.ts tests/e2e/credential-lifecycle.spec.ts --workers=1
```

Playwright's harness blanks hosted credentials and uses isolated fixtures. If using system Chromium on Linux, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; configure localhost proxy bypass where needed. On another machine install Playwright Chromium with `npx playwright install chromium`. Run lint outside Playwright's startup cleanup to avoid its temporary `test-results` directory race.

Task 21 evidence: **132 unit tests passed; 48 relevant desktop/mobile browser tests passed; lint, TypeScript and formatting passed.** Four new unit checks passed during implementation. An initial TypeScript check reported two nested SDK result-cast errors; explicit domain casts resolved them without changing queries or permissions. Production build completion is recorded in the final delivery. Do not infer hosted success from fixtures. `tests/e2e/task21.spec.ts` and `tests/task21.test.ts` cover the new behavior. Database/REST suites were not run and no SQL was applied.

## 6. Environment dependencies — names only

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: authenticated/public database client; RLS still required.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only proof/wallet/payment operations. Never expose in public variables.
- `NEXT_PUBLIC_SITE_URL`: genuine confirmation/reset callback host; verify redirects and email templates preserve Task 19's safe `next` context.
- `SOLANA_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL`: server/browser devnet RPC. Never put a private RPC secret in a public variable.
- `CRON_SECRET`: protected settlement reconciliation. Never call the reconciliation endpoint as a harmless read-only test.
- `NEXT_PUBLIC_REOWN_PROJECT_ID`: legacy optional SDK dependency; current supported Phantom/Solflare connection must not reintroduce unsupported QR pairing.
- `PROOFPAK_E2E`: local fixtures only; keep unset on real deployments.

No new variables or environment changes are required by Task 21. Retain actual secret values only in the authorized password manager/platform settings.

## 7. Next five valuable tasks

1. **Resume controlled release verification only when the owner unpauses it:** establish serving SHA, recoverable data protection and approved schema/code compatibility; no blind migration replay.
2. **Perform reserved hosted account acceptance:** candidate Passport, organization/category review, credential acceptance/correction, contact and paid-work privacy. Reuse `docs/PROOFPAK_HOSTED_TESTING_GUIDE.md`.
3. **Finish organization context continuity:** several existing destination lists aggregate authorized organizations; avoid rewriting permissions. Existing-company registration still uses the original validated form and could be shortened in a separate task.
4. **Improve professional history and employer utility:** optional structured education/experience and targeted opportunity search pagination, with separately reviewed additive schema if needed. Do not convert self-added claims into credentials.
5. **Run targeted dependency and operational reliability follow-up:** refresh known transitive advisories; separately authorize tiny devnet proof/payment/recovery tests with real wallets. Do not introduce escrow/mainnet or a new smart contract merely for complexity.

## 8. GitHub review and recovery instructions

Normal push (authorized for this task):

```bash
git push --set-upstream origin task-21-passport-organization-handover
```

PR target: `main`; title: **ProofPak: Authentication, Dashboard Guidance and Passport Reliability**. Include Tasks 19–21, local test results, outstanding schema dependencies and unverified hosted behavior. Use the prepared comparison URL if API authentication remains blocked:

<https://github.com/robinwiz006-creator/PakProof/compare/main...task-21-passport-organization-handover?expand=1>

Do not merge until production compatibility and deployment coordination are demonstrated. Do not bypass branch protections or alter Vercel/Supabase settings. To resume in another coding tool, read this file, inspect Git status, preserve local-only material, check out the latest remote Task 21 branch and start with focused tests—not another general audit.
