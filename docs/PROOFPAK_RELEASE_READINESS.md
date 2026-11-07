# ProofPak release readiness — Task 14

**Review date:** 7 November 2026, Asia/Karachi. **Application branch:** `fix-wallet-specific-connection`. **Application HEAD:** `e567cef211d69cbf0cb28b64f70753bb62c43d8a`.

This is a release review, not production approval. No application code/dependency changes, hosted queries/migrations, deployment settings, pushes, merges or blockchain transactions were performed. Safe local tests use disposable databases and explicitly offline browser fixtures. This new report is intentionally left uncommitted for review; the application HEAD remains unchanged.

## 1. Executive recommendation

**A — Safe to push the feature branch and begin isolated preview testing**, provided the preview-isolation setup below is completed before enabling/using its automatic Vercel preview. This does not mean production-ready, zero vulnerabilities, or hosted/wallet verified.

No merge conflict or confirmed new application release blocker was found. The remaining gates are environment isolation, a reviewed migration rollout, real hosted account/wallet acceptance and a production security-risk decision. A push must still be separately approved; none was made here.

**Important:** this Codex environment's Supabase configuration matches the known production project. It must NOT be reused for hosted test journeys. A separate hosted Supabase test project and its credentials have not been confirmed. Vercel project settings/deployments were not available through an authenticated connector, so preview environment scoping and any existing deployment URL remain unverified.

## 2. Git state and push readiness

Remote references were fetched explicitly because the configured fetch refspec tracks only remote HEAD. Fresh references:

| Item                                     | Verified result                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| Local branch/HEAD                        | `fix-wallet-specific-connection` / `e567cef211d69cbf0cb28b64f70753bb62c43d8a`  |
| `origin/main`                            | `c92cf0a8b59b65c59ab94ac2224580c51f15c7b8`                                     |
| Remote feature branch                    | `96795c8858279506efd14f3c2875146a23a3298e`                                     |
| Main versus local (`origin/main...HEAD`) | 4 main-only commits; 12 local-only commits                                     |
| Remote feature versus local              | 0 remote-only; 12 local-only; normal fast-forward push possible at review time |
| Integration simulation                   | `git merge-tree --write-tree origin/main HEAD` succeeded without conflicts     |
| Simulated merged tree                    | `d9512eb9b493b09d5138656078a5de048ae8faee`, identical to current HEAD's tree   |
| Changes versus main                      | 135 files, 12,684 insertions and 710 deletions                                 |
| Tracked working-tree changes             | None at review start; none made by this task                                   |

The four main-only commits are merge commits: `c92cf0a` (PR #7), `1239fb7` (PR #6), `4a30750` (PR #5), `a41ec33` (PR #4). The identical simulated tree means there are no incoming content changes to resolve at this snapshot, despite divergent ancestry. No merge/rebase/reset was executed; merge-tree only computed an object and did not change the index or branch. GitHub conflicts/check results after a future push must be checked again; this is not a GitHub review approval.

### Complete local-only release commits, oldest first

| Commit    | Change                                                                     |
| --------- | -------------------------------------------------------------------------- |
| `e40ce26` | Shared visual consistency, navigation and professional-record presentation |
| `fba7181` | Next.js security/build fix                                                 |
| `25fa920` | Paid-project public/private data boundary                                  |
| `f7efd78` | Issuer category permissions and representative attribution                 |
| `90935a2` | Challenge assessments and explicit linked credentials                      |
| `f686d06` | Employer discovery, private shortlists and consent-based contact requests  |
| `2f854a6` | Paid-project lifecycle and payment recovery controls                       |
| `dce33f6` | Public revocation privacy boundary                                         |
| `8c6cbae` | Targeted dependency security fixes                                         |
| `af9c460` | Signed Solana recovery and safe unsigned cancellation cleanup              |
| `e784c9c` | Credential correction and supersession                                     |
| `e567cef` | Private employer contact handoff                                           |

Earlier homepage/dashboard redesign, wallet simplification, credential presentation, recipient URL lookup and navigation improvements are preserved by ancestry. The local-only work extends them; no branch was rebuilt or reset.

### Untracked documents and sensitive files

These pre-existing untracked files were retained unchanged: `docs/PROOFPAK_INTEGRATION_REVIEW.md`, `docs/PROOFPAK_PREVIEW_TEST_PLAN.md`, `docs/PROOFPAK_PRODUCT_AUDIT.md`. This task adds only `docs/PROOFPAK_RELEASE_READINESS.md` as another untracked report. Review documentation ownership/content before adding it to a commit; do not use `git add .` blindly.

`.env.example` is the only tracked environment file. `.env*`, `.vercel`, private PEM files and generated browser/build artifacts are ignored, with only `.env.example` deliberately excepted. A tracked-file scan found no environment/private-key paths or checked private-key, Supabase secret-key, GitHub-token or AWS access-key patterns. This is a scoped scan, not proof that every possible secret format is absent. No secret values were printed. Public project IDs, schema UUID fixtures and allowlisted public token addresses are not signing secrets.

## 3. Migration chain and actual production uncertainty

**Files in main are not proof of hosted application.** No hosted migration ledger or production database was read. The eight migrations absent from `origin/main` are source-new; which are actually outstanding in production is unknown. Manually applied SQL may not have a complete Supabase migration ledger. Compare both history and read-only object/policy checks before deciding what is missing.

Apply only outstanding files in this filename order. Never reapply the initial migration to an existing database.

| Order | Migration filename                               | Purpose / dependency                                                                                                                                                | Source comparison |
| ----: | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
|     1 | `202610110001_initial.sql`                       | Profiles, companies/memberships, challenges, submissions, reviews, achievements and original proof records; relies on normal Supabase Auth                          | In main           |
|     2 | `202610120001_passport_foundation.sql`           | Profile/project improvements, sharing and immutable achievement claim snapshots                                                                                     | In main           |
|     3 | `202610120002_organizations_credentials.sql`     | Organizations, issuer administration, credentials, consent, evidence, lifecycle and qualification requests                                                          | In main           |
|     4 | `202610120003_credential_proofs.sql`             | General credential v3 proof records and controlled recording                                                                                                        | In main           |
|     5 | `202610120004_wallet_ownership.sql`              | Nonce-based wallet ownership and account/organization linkage                                                                                                       | In main           |
|     6 | `202610120005_paid_projects.sql`                 | Paid projects, applications, offers, agreements, milestones and reviews                                                                                             | In main           |
|     7 | `202610120006_milestone_payments.sql`            | Payment intents/attempts/receipts and strict settlement boundary                                                                                                    | In main           |
|     8 | `202610120007_paid_work_history.sql`             | Consented completed-work Passport records                                                                                                                           | In main           |
|     9 | `202610120008_payment_workflow_guards.sql`       | Additional payment/preparation/ownership guards                                                                                                                     | In main           |
|    10 | `202611050001_paid_project_public_privacy.sql`   | Restricted operational table access and safe public project/milestone projections; depends on paid-project/payment models                                           | New vs main       |
|    11 | `202611050002_issuer_trust.sql`                  | Explicit type permissions, immutable authorization snapshots and representative audit                                                                               | New vs main       |
|    12 | `202611050003_challenge_assessments.sql`         | Rubric/review snapshots, approved-work source and authorized linked issuance; needs issuer trust                                                                    | New vs main       |
|    13 | `202611050004_employer_discovery.sql`            | Opt-in search, private shortlists and contact request permissions                                                                                                   | New vs main       |
|    14 | `202611050005_paid_project_lifecycle.sql`        | Guarded draft edits, withdrawal/cancellation and private lifecycle audit; needs paid work/payment guards                                                            | New vs main       |
|    15 | `202611060001_credential_revocation_privacy.sql` | Safe public event projection and restricted raw audit; detects unexpected grants/policy drift                                                                       | New vs main       |
|    16 | `202611060002_credential_corrections.sql`        | Controlled replacement lineage, challenge duplicate compatibility, consent and replacement-aware verification/search; needs issuer trust, assessments and discovery | New vs main       |
|    17 | `202611070001_contact_handoff.sql`               | Bounded private follow-up, consent gates and terminal contact states; needs discovery and paid/challenge models                                                     | New vs main       |

### Fresh and populated local validation

`npm run test:db` creates disposable PostgreSQL databases, applies the complete chain, exercises security/workflows and tests populated historical upgrades. Additional direct PostgREST tests use the actual local RLS/grant boundary. They do not connect to hosted Supabase. Supabase-specific hosted configuration and service-role behavior still need preview validation.

**Never run `tests/database-bootstrap.sql` or local fixture SQL in hosted Supabase.** Those files synthesize local Auth roles/schema for disposable PostgreSQL. A hosted Supabase project already provides Auth and platform roles. Use only reviewed application migrations and founder-created test accounts there.

### Administration required after migration

1. In the isolated test project, register a separate administrator using normal Auth. A trusted project owner must explicitly bootstrap that exact test user's UUID into `platform_administrators`; the reviewed example is in `docs/CREDENTIALS-WALLETS-DELIVERY.md`. This was not executed here.
2. Keep that administrator outside organizations they review. Administrators cannot approve their own organization.
3. Organization registration alone grants no issuer authority. Review identity/representative evidence independently, then use `/issuer-admin` and select only justified credential categories.
4. The issuer-trust migration gives existing issuers an empty permission array. Their old authorization status/history is preserved, but new issuance needs a new explicit category review. Do not infer broad rights from old credentials or a linked wallet.
5. `degree` requires a university organization and separate academic-authority review. A self-selected university type is not accreditation. Use clearly labeled synthetic organizations in preview; do not claim real institutional authorization.
6. Verify permitted issuance and rejection of an unpermitted category, suspension, independent administrator checks and issuing representative attribution. Suspension/category reduction does not silently revoke historical credentials; revocation is explicit.

### Schema/code coordination and preflights

Migration-before-matching-code is required. Safe public views, new RPCs, correction status and new profile fields must exist before this code runs. In particular:

- Paid-project privacy revokes old public raw-table access. Old public project pages may fail between migration and code update. Do not weaken grants to keep old code working.
- Revocation privacy requires the new public-event projection used by `credentialSelect`.
- Issuer trust needs the current administration UI for category selection; legacy approval calls cannot grant categories and can clear scope conservatively.
- Assessments, discovery, lifecycle, corrections and handoff all add functions or statuses that older code does not fully understand.
- New correction operations should not be used during mixed-version deployment. Old code may still present superseded records as current. Old stored v1/v2/v3 hashes/receipts remain unchanged.

Use the matching read-only checks: `docs/check-phase-1.sql`, `docs/credentials-wallets-preflight.sql`, `docs/credentials-wallets-validation.sql`, `docs/payments-preflight.sql`, `docs/payments-validation.sql`, and `docs/check-{paid-project-privacy,issuer-trust,challenge-assessments,employer-discovery,paid-project-lifecycle,credential-revocation-privacy,credential-corrections,contact-handoff}.sql`.

Preflight expectations vary: absence is expected only for a genuinely unapplied migration. If new objects already exist, stop and compare their definitions/history instead of replaying SQL. Preserve before/after record counts and fingerprints privately, and investigate integrity-review failures rather than inventing snapshots. Privacy migrations intentionally abort on unexpected grants/policy drift.

Production rollout needs a coordinated quiet/maintenance window and verified backups. Files contain their own transactions: failure rolls back that file, not all preceding successfully committed migrations. Stop at the failed file; retain the applied history and investigate before continuing. Do not rerun the whole chain over a partially migrated database.

## 4. Preview deployment prerequisites

### Required environment configuration

No secret values are included below. Configure **Vercel Preview** with the test project's values; leave Production unchanged. Audit all existing Preview values and branch overrides before pushing, because Vercel may automatically deploy a pushed branch.

| Variable                               | Requirement                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Separate test project URL; never the production project for preview acceptance                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key belonging to that same test project                                                                                                 |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only key from the same test project; required for wallet verification and proof/payment storage; never `NEXT_PUBLIC_`                   |
| `NEXT_PUBLIC_SITE_URL`                 | Exact stable preview HTTPS origin used for account tests; public variables require a new build when changed                                    |
| `SOLANA_RPC_URL`                       | Server-side devnet RPC; keep key-bearing URLs server-only; support finalized and historical transaction/account queries                        |
| `NEXT_PUBLIC_SOLANA_RPC_URL`           | Browser-usable devnet RPC; credentials here are public; provider must allow browser CORS/origin requests                                       |
| `CRON_SECRET`                          | New server-only, test-environment reconciliation secret; required for scheduled endpoint authentication, not ordinary Passport use             |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`         | Optional public identifier for legacy remote-session recovery only; not needed for supported Phantom/Solflare extension/in-app-browser linking |
| `PROOFPAK_E2E`                         | Leave unset for hosted preview and production; offline fixtures must stay disabled                                                             |

Local presence-only check: Supabase URL/public key/service key, site URL, both RPC variables and Reown ID are present; `CRON_SECRET` and `PROOFPAK_E2E` are missing/empty. Local Supabase matches the known production project. This does not prove key pairing, remote permissions, Vercel values or a usable test environment. No `doctor` or hosted workflow tests were run against that configuration.

### Vercel configuration

- Existing Next.js App Router deployment is compatible with `npm ci` and `npm run build`; runtime constraint is Node `>=24.19.0 <25`, `.nvmrc` is `24.19.0`. Select Node 24.x and confirm the actual builder/runtime patch meets the minimum. Do not silently lower the engines requirement.
- `next.config.ts` uses `.next` normally and `.next-e2e` only for gated local browser testing. It contains no deployment migration hook.
- `vercel.json` schedules `/api/payments/reconcile` at `0 0 * * *`. The protected endpoint checks `CRON_SECRET`, reads devnet outcomes and can update verified database settlement records; it does not send transfers. Do not assume cron runs for previews. Verify scheduling/plan/runtime support and test authorized reconciliation only later in the isolated project.
- Use deployment protection and a limited test audience while residual dependency risks and workflows are under review. Do not disable application authorization to accommodate deployment protection.
- A local build is not Vercel confirmation. No preview URL, deployment result, environment scope, GitHub check or production deployment status was confirmed through an authenticated deployment service.

### Supabase Auth and redirects

In the **test** Supabase project, open **Authentication → URL Configuration**:

1. Set Site URL to the stable preview origin, e.g. `https://<your-actual-preview-host>`.
2. Add exact permitted redirect URLs `https://<your-actual-preview-host>/auth/callback` and `https://<your-actual-preview-host>/auth/callback?purpose=recovery`. Add local-development callback equivalents only if local test Auth is intended.
3. Keep email confirmation enabled. Verify sender/SMTP delivery and the project's actual email rate limits; use a suitable approved test-email setup if needed rather than disabling security.
4. Configure Vercel Preview `NEXT_PUBLIC_SITE_URL` to the same host and rebuild. Always start signup/login/recovery from that host; using another deployment host can lose the PKCE/session cookie at the callback.
5. Follow confirmation/reset links in the browser context that initiated the flow. Use Incognito separately to test public Passport/credential visibility, not as a substitute for the original PKCE confirmation browser.

For an eventual production release, review the equivalent production Site URL and exact callback URLs for `https://pak-proof.vercel.app` (or the actual final approved custom domain). Do not point production Auth at the preview, share test service credentials with production or add permissive wildcards unnecessarily. This review did not change either project's settings.

### Wallet and devnet requirements

The default wallet flow remains wallet-specific Phantom/Solflare extension connection or supported mobile in-app browser use. Desktop phone/QR pairing is disabled; do not claim it works or reintroduce the generic marketplace. If legacy Reown recovery is needed, configure its public ID and allow the exact preview origin in that Reown project's permitted domains. Ordinary extension linking needs no Reown setup.

Users keep email/password Auth. Wallet linking requires a server-issued nonce and verified signature with the intended personal, company payer or credential issuer purpose. A paying wallet does not grant credential authority. Test actual purpose selection and controlled unlink/replacement with the correct organization membership.

Configuration is devnet-only: allowlisted test mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, Token Program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, six decimals. `paymentNetwork()` checks devnet genesis and the finalized mint's owner/layout/decimals before preparation. No live mint/RPC lookup or real transaction was performed during this task. Before an authorized wallet test, obtain free devnet SOL for the payer's fees and that exact mint's test tokens; do not substitute arbitrary test mints or mainnet USDC.

## 5. Final automated validation

| Check                                                                 |    Passed | Failed | Skipped | Final result                                          |
| --------------------------------------------------------------------- | --------: | -----: | ------: | ----------------------------------------------------- |
| Unit tests (`npm test`)                                               |        93 |      0 |       0 | Exit 0                                                |
| Fresh-chain/database security/preservation suites (`npm run test:db`) | 15 suites |      0 |       0 | Exit 0; complete 17-file chain and populated upgrades |
| Direct PostgREST security (`npm run test:privacy`)                    |        61 |      0 |       0 | Exit 0                                                |
| Full desktop/mobile browser suite                                     |       182 |      0 |       0 | Exit 0, 6.0 minutes; no retries                       |
| TypeScript (`npm run typecheck`)                                      |         — |      — |       — | Passed, exit 0                                        |
| Formatting (`npm run format:check`)                                   |         — |      — |       — | Passed, exit 0                                        |
| Lint (`npm run lint`)                                                 |         — |      — |       — | Final sequential run passed, exit 0                   |
| Explicit production build (`npm run build`)                           |         — |      — |       — | Passed, exit 0; security checks retained              |

**Retry accounting:** the initial combined lint/type/format/unit command stopped at lint with exit 2: ESLint tried to scan `test-results` while Playwright removed/recreated that directory at startup (`ENOENT: scandir`). TypeScript, formatting and unit tests were then run separately and passed. Lint was rerun sequentially after the browser suite and passed; no source/configuration change or ignored security check was used. No browser, unit, database or REST test failed or required a retry during this task. Avoid overlapping lint filesystem scans with Playwright artifact initialization in the release sequence.

Browser tests explicitly clear Supabase/service/cron settings and use offline fixtures/access guards. SQL and REST tests use isolated Docker PostgreSQL/PostgREST, not shared or production data. Unit transaction fixtures do not prove physical-wallet success. A successful local build is not a verified Vercel deployment.

Workspace evidence logs: `/tmp/task14-{unit,db,rest,browser,typecheck,format,lint,build}.log`; audit JSON `/tmp/task14-audit.json` and `/tmp/task14-audit-prod.json`. These are temporary local artifacts, not production acceptance evidence. The first lint error is recorded in the tool execution history; the combined command stopped before creating its intended final redirected log.

## 6. Release risk classification

| Area                                                           | Classification                                                                                                                                   | Evidence / disposition                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing isolated hosted project / unknown Vercel Preview scope | **Blocking preview use** until configured; not an application-code Git push blocker if automatic deployment is safely disabled or isolated first | Local configuration matches production. No separate hosted test credentials or preview settings confirmed. Do not click through account/workflow tests against production                                                          |
| Hosted migration status, backups and code coordination         | **Blocking production release**                                                                                                                  | Seventeen source migrations are not hosted history. Eight source-new files versus main; actual outstanding set unknown. Backup and individually reviewed migration-first rollout required                                          |
| Paid-project public privacy and revocation staff privacy       | **Automatically tested locally; manual hosted validation required**                                                                              | Safe public projections, restricted raw grants and RLS in `202611050001` / `202611060001`; direct REST tests include column/embedding bypass attempts. Original deployed policies are not verified here                            |
| Issuer categories and administrator setup                      | **Blocking new test/production issuance until explicit setup**                                                                                   | Conservative empty scopes, current category/approval checks and private representative audit; independent administrator review required. Not government accreditation or automatic institutional identity proof                    |
| Correction/supersession                                        | **Manual lifecycle acceptance required**                                                                                                         | Database locks, unique active successor, immutable originals and fresh recipient consent tested. A private replacement can supersede a public original without revealing it; reviewers/users must understand that behavior         |
| Historical v1/v2/v3 claims                                     | **Locally tested; hosted historical sample required**                                                                                            | No serializer rewrites; populated migration and claim/hash compatibility tests. New corrections use current v3 rather than modifying old receipts                                                                                  |
| Contact handoff                                                | **Locally tested; hosted two-account privacy/abuse validation required**                                                                         | Bounded notes, member isolation, consent, terminal closure, retry deduplication and quotas enforced in DB. No external notifications or full messaging/moderation platform                                                         |
| Paid-project cancellation                                      | **Manual acceptance and accepted product limitation**                                                                                            | Bilateral post-agreement handling, receipt/unknown-payment locks and audit history tested; no refund guarantee, escrow, unilateral accepted-term edits or mark-paid override                                                       |
| Solana proof/payment recovery                                  | **Real-wallet/reliable-RPC validation required; documented residual limitation**                                                                 | Signed bytes/signatures and uncertainty guards tested. Browser-origin storage is not portable; unreturned/erased signatures may need wallet/operator diagnosis. Never retry unknown outcomes with a new transfer                   |
| In-progress proof versus supersession                          | **Operational release caution**                                                                                                                  | Finish/reconcile an original's signed proof before accepting replacement. Superseded records cannot register new proofs through normal API; stored historical proofs remain verifiable. Do not bypass validity checks to repair it |
| Exact USDC settlement and duplicate prevention                 | **Automated verification tested; real devnet completion not verified**                                                                           | Integer amounts, successful finalization, actual transfer/mint/program/decimals, source authority, recipient ownership, balances and receipt uniqueness checked server-side. No mainnet/real-money readiness claimed               |
| Dependency advisories                                          | **Residual risk acceptable only for restricted synthetic-data preview; production security decision remains a gate**                             | Fresh audit details below. No demonstrated ProofPak exploit, but potentially reachable SDK/native/frame input remains. Do not call unresolved advisories harmless or mark them fixed                                               |
| Browser/build test coverage                                    | **Not hosted acceptance evidence**                                                                                                               | Offline UI/control cases and local permission tests do not establish SMTP, hosted Auth, Vercel execution or physical-wallet compatibility                                                                                          |
| Secret handling                                                | **Scoped scan passed; remote configuration manually verify**                                                                                     | No tracked sensitive files/checked patterns. Public API keys do not replace RLS; service credentials remain server-only                                                                                                            |

### Fresh dependency audit

`npm audit --json --cache /tmp/task14-npm-cache`: **22 affected package entries = 14 high, 8 moderate, 0 critical, 0 low/info**. Production `--omit=dev`: **14 entries, all high**. Both commands exit 1 because findings remain, not because audit was disabled. Counts include propagated parent packages; they are not 22 independent exploits.

| Root advisory                                                                                                      | Installed path / version                                                     | Exposure and release decision                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg), bigint-buffer native buffer overflow     | Reown Solana adapter → SPL Token/buffer-layout-utils → `bigint-buffer@1.1.5` | RPC/account bytes are an untrusted SDK boundary; exact native exploit path not demonstrated. Prior source/artifact review found conversion code, so absence cannot be assumed. No compatible patched leaf reported. Retain only under restricted test scope pending a reviewed upstream/dependency resolution |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), constrained-collection memory exhaustion | Nested `zod@3.22.4` in Reown wallet and `3.25.76` in Coinbase SDK            | Root app form Zod is patched `4.6.6`; nested SDK versions are not. Legacy provider/frame initialization may reach untrusted data. Default new wallet selection does not offer that flow, but legacy recovery still imports the graph. No safe blanket major override established                              |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), glob amplification                       | Development `typescript-estree` → `minimatch@10.2.6`                         | Lint/build tooling rather than deployed application endpoint. Untrusted repository/file patterns remain a tooling risk. npm suggests a major framework-config change/downgrade; not applied blindly                                                                                                           |

Existing targeted fixes are retained: `follow-redirects@1.16.2` and the explicitly reviewed `jayson@5.0.0` override, with real SDK offline RPC compatibility tests. No dependency was upgraded, removed, suppressed or force-fixed during this review. See `docs/DEPENDENCY-SECURITY-REVIEW.md` for path/exposure details; the fresh counts above supersede earlier cache-dependent counts.

## 7. Accounts and manual acceptance checklist

Create only synthetic preview accounts/data, not production exports or real institutional claims.

| Role                                                | Purpose                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Individual/worker A                                 | Profile/project publication, challenge submission, credential consent, contact response and paid milestones   |
| Independent administrator B                         | Bootstrap in the test project only; review organizations/categories; must not belong to reviewed organization |
| Organization owner C                                | Company profile, challenges/assessments, permitted issuance, paid project terms/reviews and contact requests  |
| Reviewer D in C's company                           | Shared permissions, representative attribution and organization note quota/isolation                          |
| Different organization E and unrelated individual F | Cross-organization, private evidence, contact and payment authorization denial                                |
| Incognito/public visitor                            | Published-only Passport/credential/opportunity verification and raw REST denial                               |

Use the existing release guides for full fields. Record PASS/FAIL/NOT TESTED per step; retain only public URLs, synthetic IDs and approved devnet signatures—never passwords or keys.

- [ ] Preview database is separate and complete; URL/public/service keys all belong to it. No production Auth users copied.
- [ ] Register A/C/B, confirm email in the initiating browser, login/logout, resend confirmation and password recovery. Verify first-login routing and actionable errors.
- [ ] A adds profile, skills, project/evidence, previews, publishes and opens the public Passport in Incognito. Toggle privacy and discovery/contact independently.
- [ ] B independently approves C for only a justified category. C cannot approve itself or issue an unauthorized degree. Verify suspension and issuing representative audit; private reviewer data stays private.
- [ ] C publishes a challenge/rubric; A submits, receives revisions and resubmits. C approves: achievement is created, **not** automatically a credential. C separately issues linked recognition under category permissions; A accepts/publishes explicitly. Check assessment/evidence privacy.
- [ ] C proposes a correction. Verify original immutable/current until valid acceptance; decline/retry; accept privately; public supersession without private successor ID; explicit publication; revoked original history remains revoked. Finish unknown original proofs before accepting a replacement.
- [ ] C searches/saves A and sends purpose-bearing contact with/without an opportunity. A accepts, both send bounded notes; retry does not duplicate. Close/withdraw; ensure no continuation. Private/opted-out candidate and second organization cannot access the exchange.
- [ ] C creates/edits a draft paid project, publishes; A applies, C selects; A accepts immutable terms. Test revisions, approval, unsigned cancellation, bilateral project cancellation and unknown/paid locks separately.
- [ ] After explicit transaction permission, use actual Phantom and Solflare supported methods to sign ownership messages for personal/payer/issuer purposes. Reject signatures, reconnect, refresh and test protected unlink. No QR claim.
- [ ] After explicit transaction permission, anchor an accepted current credential/achievement with a real devnet Memo; wait for finalized server verification, record signature, then check public integrity and old v1/v2/v3 samples. Reject a mismatched/pending transaction.
- [ ] After explicit transaction permission, pay one small exact test-token milestone. Confirm finalized actual transfer, receipt uniqueness, refresh/reconciliation and no duplicate repayment. Never substitute mainnet funds or manually mark paid.
- [ ] Completed work enters the Passport only under worker consent; payment amounts/private terms stay out of public application views. Payment does not automatically issue a verified-skill credential.
- [ ] Test 320px/390px and desktop, keyboard access, organization/member boundaries, raw REST column access, public/private transitions, loading/errors and empty states on the hosted preview.

None of these hosted/physical-wallet checklist items was marked complete by local builds or fixtures.

## 8. Safe next Git and release operations

These are instructions for later explicit approval, not actions performed here.

1. Resolve preview scoping first: create the separate test project and safely configure Vercel Preview, or keep automatic preview deployment disabled until ready. Verify production settings are untouched.
2. Review this report and the three pre-existing untracked audit documents. If the report should travel with the branch, stage **only this report** and create a documentation-only commit; do not accidentally add private exports or environment files. Application evidence above refers to `e567cef`.
3. Refresh references and repeat conflict/ancestry checks immediately before push:

   ```bash
   git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/fix-wallet-specific-connection:refs/remotes/origin/fix-wallet-specific-connection
   git status --short
   git rev-list --left-right --count origin/fix-wallet-specific-connection...HEAD
   git merge-tree --write-tree origin/main HEAD
   ```

4. After explicit push approval, use a normal push, never force:

   ```bash
   git push origin HEAD:refs/heads/fix-wallet-specific-connection
   ```

   If the remote moved and rejects the push, stop and review; do not reset/rebase/force automatically.

5. Check whether an existing open PR for this branch updates. Do not assume the historically used PR remains open: main already contains merge PR #7. Only create a new PR if there is no appropriate open one. The comparison URL is `https://github.com/robinwiz006-creator/PakProof/compare/main...fix-wallet-specific-connection`. A comparison URL is not proof a PR exists.
6. Review GitHub checks and the actual Vercel preview deployment for the pushed commit. Confirm **Ready**, exact commit SHA and test-project environment; a successful local build or HTTP homepage alone is not enough. No repository workflow files were found locally, so do not assume comprehensive GitHub CI will run automatically.
7. Apply reviewed outstanding migrations in the isolated project only with approval, verify RLS/grants/record preservation, and complete the acceptance checklist. Keep production untouched.
8. Production requires separate approval after preview evidence, backup recovery verification, security risk decision and coordinated migration/code plan. A future merge to Vercel-connected main may automatically deploy production; do not merge early.

## 9. Rollback and recovery

- Before hosted changes, retain secure, usable schema/data/Auth recovery exports and relevant storage objects/metadata if used. Keep backups outside Git and verify restoration into an isolated recovery project. This task did not create or verify a production backup.
- Preserve a known code SHA and applied migration ledger. Do not reset production, rerun initial SQL or reverse privacy grants to roll back availability problems.
- Once new schema/statuses/records are used, old application code may misrepresent superseded/closed/cancelled states or query revoked raw permissions. A Vercel rollback is safe only to a schema-compatible tested version. Prefer pausing affected actions and a reviewed forward fix; restoring an old database can erase newer credential/payment records.
- Do not rewrite credential hashes or delete revocation/correction/assessment/audit history. Use controlled replacement/revocation and preserve recipient consent.
- Preserve original signed transaction bytes, signatures, intent/attempt/milestone IDs and expected payout details. Browser-local recovery is same-origin: switching preview domains, clearing site data or using another device can lose unregistered recovery state. Registered server attempts can be reconciled by their original signature.
- Never automatically repay an unknown outcome, clear signed locks, cancel a broadcast transfer, edit immutable receipts or use a manual mark-paid action. Diagnose with reliable devnet history and existing authorized reconciliation. If original signed bytes never returned or a preparation was invalidated before registration, operator review may still be necessary.
- Direct payments are not escrow or guaranteed/refundable funds. Closing contact or cancelling a project does not reverse an onchain transfer. Current tokens have no monetary value; no real-money release claim is made.

**Final conclusion: A for a reviewed, isolated preview candidate; production release remains gated.**
