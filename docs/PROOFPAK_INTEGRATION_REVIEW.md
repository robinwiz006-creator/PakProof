# ProofPak integration and release readiness review

**Review date:** 6 November 2026 (Asia/Karachi).  
**Code reviewed:** `fix-wallet-specific-connection`, commit `2f854a6` (`Add controlled paid-project lifecycle and signed-payment recovery`).  
**Scope:** audit only. Application code, dependencies, migrations, hosted configuration, production records and blockchain state were not changed. This report is the only new repository file created for this task. Existing untracked audit and preview-plan documents were left untouched. No commit, push, merge or deployment was performed.

## 1. Executive assessment

ProofPak now has a connected application architecture around a professional Passport. It is not merely a set of unrelated mock screens:

- Individuals can build a Passport without a wallet, challenge participation or payment.
- A company can assess challenge work, approve an achievement, and separately issue an organization credential if it has the necessary permissions.
- Recipients control whether credentials and evidence become public.
- Organization members can search opted-in public Passports, save private shortlists, and request contact without automatically obtaining email addresses.
- Paid projects connect agreements, milestone reviews, owned wallets, strict devnet settlement verification and consent-based completed-work records.

**However, this is an implemented and substantially locally tested release candidate—not a production-verified product.** A confirmed public staff-identifier exposure, dependency advisories, recovery edge cases, credential correction limitations and the lack of an isolated hosted acceptance baseline prevent an unconditional release recommendation.

The most important new confirmed privacy finding is small in scope but real: anonymous visitors can retrieve the **revoking representative's account UUID** from a public credential's revocation event. No email, private key or private credential was exposed in the audit. The underlying issue is a public row policy combined with full-table column access. A disposable REST reproduction confirmed it.

**Recommended first development task:** introduce a safe public revocation-status projection while keeping staff attribution private, update affected credential reads, and add direct REST regression tests. Do not rewrite historical credential claims or delete revocation records.

### Readiness vocabulary used here

| Label | What it means |
|---|---|
| Locally implemented | The current source and database migrations contain the workflow. |
| Automatically tested | Specified behavior passed a local unit, SQL, REST or browser test. This does not mean every screen or failure case was tested. |
| Hosted verified | Tested against the actual deployed code, hosted schema, Auth configuration and accounts. **Not established in this audit.** |
| Production ready | Security, migrations, deployment baseline, real-user journeys and operational recovery have passed release gates. **Not established.** |

## 2. Repository, architecture and deployment baseline

### Repository findings

- Branch and HEAD match the requested starting point: `fix-wallet-specific-connection` / `2f854a6`.
- A read-only `git ls-remote origin refs/heads/main` returned `c92cf0a8b59b65c59ab94ac2224580c51f15c7b8`, matching the existing local `origin/main` reference.
- The commit graph is **7 commits ahead / 4 commits behind** `origin/main`. The four remote-only commits are merge commits, not four newly identified feature changes.
- Current tree versus remote main: **96 files changed, 7,428 insertions, 486 deletions** before this report.
- Local-only commits are `e40ce26`, `fba7181`, `25fa920`, `f7efd78`, `90935a2`, `f686d06`, and `2f854a6`. They cover visual consistency, framework security, paid privacy, issuer scope, assessed credentials, employer discovery and lifecycle/recovery.
- Remote main's `package.json` still declares Next.js **16.4.0**. This branch uses **16.4.5**. Remote main contains the original nine migrations, but not the five `20261105` migrations. This establishes a repository release gap; it does **not** establish what is currently running on Vercel or installed in hosted Supabase.
- Existing untracked files at the beginning were `docs/PROOFPAK_PRODUCT_AUDIT.md` and `docs/PROOFPAK_PREVIEW_TEST_PLAN.md`. Neither was modified or included in a commit.

### Architecture

| Area | Actual implementation and evidence |
|---|---|
| Web application | Next.js App Router, Server Components, Server Actions and API route handlers. `src/app`, `src/lib/actions.ts`, `src/lib/credential-actions.ts`, `src/lib/paid-actions.ts`. |
| Installed versions | Node 24.19.0; Next.js 16.4.5; React 19.3.0; TypeScript 5.9.3; Supabase JS 2.117.3. `package.json`, `package-lock.json`, installed package manifests. |
| Authentication | Supabase email/password, PKCE callback, resend and reset actions. Request-scoped client and user caching; proxy refreshes claims/cookies. `src/lib/supabase/server.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`. |
| Authorization | PostgreSQL RLS, explicit grants, security-definer workflow functions and server-side checks. UI role selection does not grant company membership or administrator power. `supabase/migrations/*.sql`. |
| Data model | Profiles/projects; companies/memberships; organizations/issuer decisions; challenge submissions/reviews/assessments/achievements; credentials/preferences/evidence/events/proofs; employer shortlists/contact; paid agreements/milestones/payments/history. |
| Solana | Wallet Standard message/transaction signing; v1/v2 achievement Memo commitments; v3 credential Memo commitments; SPL TransferChecked devnet payments. `src/lib/proof.ts`, `credential-proof.ts`, `payment-chain.ts`, `wallet-ownership.ts`. |
| UI | Shared workspace navigation, profile setup, record components and existing ivory/orange design. `src/components/portal-nav.tsx`, `workspace-frame.tsx`, `passport-view.tsx`, `credential-detail.tsx`. No new visual redesign is needed to repair the findings. |
| Deployment | `next.config.ts` selects `.next` or `.next-e2e`; `vercel.json` schedules `/api/payments/reconcile` daily. Node engine is `>=24.19.0 <25`. No hosted deployment inspection was performed. |

### Environment requirements and observed presence

Names only; no values or credentials were printed. The shell's Supabase URL matches the already known production project, so it was **not used for workflow tests**. `npm run doctor` was deliberately not run against it.

| Variable | Purpose | Shell observation—not Vercel verification |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase endpoint | Present; known production project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe API identifier; RLS remains required | Present |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only ownership/proof/settlement operations | Present; not used for hosted writes or account tests |
| `NEXT_PUBLIC_SITE_URL` | Email callback/reset origin | Present; correctness for a future preview unverified |
| `SOLANA_RPC_URL` | Server devnet history and settlement RPC | Present; live availability/mint not tested in this audit |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Browser devnet RPC | Present; browser CORS/device availability unverified |
| `CRON_SECRET` | Protected reconciliation job | Absent from shell; hosted value unknown |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Legacy session recovery only | Present; not required for normal Phantom/Solflare linking |
| `PROOFPAK_E2E` | Isolated offline browser fixtures | Set by the local browser harness only; must remain unset on real-account preview/production |

Do not put a private RPC credential in a `NEXT_PUBLIC_` variable. No wallet private keys, mainnet settings or token-mint override are required.

## 3. Four product pillars and complete journeys

### A. Build your Passport

**Implemented journey:** `/` → `/sign-up` → email confirmation `/auth/callback` → `/portal/talent` → guided profile steps → project editing → preview → explicit publication → `/talent/[slug]`.

1. Signup stores the preferred workspace as metadata and relies on the existing Auth trigger to create the profile. A preliminary profiles query blocks signup if the basic schema is missing.
2. About, skills, work and publish steps use partial field whitelists. Optional fields do not block publication; the public slug and visibility choice are validated. Evidence links use the existing project editor, including update rather than duplicate insertion.
3. Public profile access requires `is_public`; project ownership and conditional reviewer access are enforced by RLS. Changing a slug changes its URL; there is no old-slug redirect registry.
4. Public presentation separates individual projects/skills, company challenge achievements, organization credentials and completed paid work. It does not require a wallet.
5. Directory discoverability and contact permission are additional opt-ins, separate from public URL publication.

**Evidence:** `src/lib/actions.ts` (`signUp`, `signIn`, `saveProject`, `saveProfileStep`, recovery actions); `src/lib/profile-setup.ts`; `src/lib/data.ts` (`publicPassport`); `src/app/portal/[...section]/page.tsx`; `src/components/passport-view.tsx`; migrations initial, passport foundation and employer discovery.

**Tested:** profile patch validation, project ownership/editing, visibility boundaries, public/private SQL/REST behaviors, guided UI/navigation and responsive fixtures. **Not tested:** real email delivery, actual session persistence/refresh, a newly registered hosted user publishing and sharing to an independent browser.

**Gaps:** credentials and completed-work sections silently disappear on query errors; experience is not a dedicated employment-history model; photos/document uploads are not a complete managed feature; private project visibility is primarily profile-wide, not an individual hidden-project control. These are different from the existing completed paid-work records.

### B. Prove your work

**Implemented journey:** company profile → published challenge and optional rubric → individual submission → review/feedback/revision → approval and achievement → separate “Issue credential for this work” → scoped authorized issuance → recipient acceptance/publication → optional issuer wallet anchoring → public verification.

- `review_assessed_submission` checks company membership, prevents self-review, locks submission/challenge, validates the current rubric version and outcomes, and snapshots the assessment. Approving a rubric-based submission requires all defined criteria to be met.
- Approval inserts an achievement. Its snapshot trigger creates the immutable achievement claim/evidence. It does **not** automatically issue a general credential.
- The review screen links to `/organizations?view=issue&submission=…`. The source workflow derives recipient and evidence from the approved work; the hidden recipient form sentinel is `reviewed-recipient`, not a private-profile lookup. Private recipients are supported by this source path.
- `issue_challenge_credential` verifies approved work, related organization, current permitted category, review and evidence snapshot. A unique submission/type constraint prevents duplicate issuance. The Task 4 insert trigger attributes the actual representative and authorization decision.
- Direct issuance by slug/full Passport URL is separate and requires a published recipient. There is no implemented general email-invitation claim flow.
- Credential acceptance and visibility are distinct recipient decisions. Private Passport, declined acceptance, unpublished credential or unshared evidence remain protected by RLS.
- Academic verification requests route to an authorized university with degree permission; staff must review them. No automatic university database lookup exists.

**Evidence:** `src/lib/actions.ts` (`reviewSubmission`); `src/lib/credential-actions.ts` (`issueCredential`); `src/app/organizations/page.tsx`; migrations `202611050002_issuer_trust.sql` and `202611050003_challenge_assessments.sql`; `src/components/credential-inbox-item.tsx`; `src/lib/credential-verification.ts`.

**Tested:** approved versus unreviewed work, immutable assessment versions, permission/type bypasses, representative attribution, duplicate issuance, consent and public assessment/evidence boundaries, historical serializers and proof verification fixtures.

**Gaps:** linked same-type correction is blocked by the duplicate constraint; revocation does not create a replacement/supersession relationship; no formal appeals process; assessment rubrics can change before review, while completed review snapshots are preserved. Organizational approval is a platform administrator decision, not government accreditation or independently proved legal identity.

### C. Find opportunities and be discovered

**Implemented journeys:**

- Individual: `/opportunities` → public challenge/project → submit challenge work or apply to paid project → track activity and decisions.
- Organization: `/portal/company/directory` → server-side Passport search/filter/page → public candidate evidence → private company shortlist → optional contact request → recipient accepts or declines in `/contact-requests`.

Search requires organization membership, not credential-issuer authorization. `search_passports` uses published **and** explicitly discoverable profiles, public projects, accepted/published credentials, and separately shared assessed summaries. It returns 20 results per page. Shortlist notes remain organization-private. Opt-out/private profiles disappear from directory results and company shortlist access. Contact quotas, duplicate requests and recipient decisions are checked in SQL under locks.

Accepting a contact request records interest; it neither starts a chat nor shares email. If a published opportunity was linked, the user follows that existing workflow. If none was linked, the current process stops at an interest record. This is honestly disclosed in the UI, but limits employer usefulness.

**Evidence:** `src/lib/live-opportunities.ts`; `src/app/opportunities/page.tsx`; `src/components/employer-directory.tsx`, `candidate-card.tsx`; `src/lib/employer-actions.ts`; `src/app/contact-requests/page.tsx`; migration `202611050004_employer_discovery.sql`.

**Tested:** public/private opt-in search, filter privacy, pagination, cross-company isolation, request quotas/concurrent duplicate prevention and acceptance/decline. Browser directory tests are offline component fixtures, not authenticated hosted employer searches.

**Gaps:** opportunity search is bounded client-side filtering over up to 100 records of each type, not full server-side paginated opportunity search. Real bounty/prize settlement is absent. General messaging, practical follow-up for unlinked accepted contacts, organization staff invitation/removal and notifications are absent. Company memberships exist, but normal owners have no complete self-service team-management workflow.

**Privacy nuance:** directory opt-out stops ProofPak's employer search/shortlist exposure. It does not make an otherwise published Passport secret or unenumerable: the original profiles RLS permits reading public profiles through the API independently of `is_discoverable`. This is source-established behavior, not a private-profile exposure. If non-listability beyond the app directory is intended, a stronger public access design is needed; do not simply claim “undiscoverable everywhere.”

### D. Get paid and build work history

**Implemented journey:** create draft → correct existing draft milestones → publish → apply → select one worker → immutable offer → worker accepts → authorize payout wallet → submit milestone → revisions/approval → owner prepares/signs exact devnet transfer → registered attempt → broadcast → independently verified settlement → all milestones settled → consented Passport work record.

- Draft corrections preserve milestone IDs/count and reject stale snapshots. Published terms lock earlier than acceptance. Accepted agreements cannot be changed unilaterally.
- Before agreement, an owner can withdraw/cancel. After agreement, cancellation requires the opposite side's confirmation. The request does not pause the agreement.
- Submitted work, approved-but-unpaid work, and unresolved preparations/signed transfers block cancellation confirmation. Existing paid receipts are not erased or refunded. Selected workers retain closed-record access; ordinary applicants do not get private operational data.
- Payment preparation, approval and verified settlement are separate. Owners pay; selected workers submit and authorize their own payout wallets; organization membership alone does not grant payer authority.
- A worker's sharing action or company disclosure-consent action initializes the completed-work snapshot after project completion. Completion alone does not automatically publish history. Public history requires both consents and a public Passport. Evidence has another opt-in. Payment amounts and wallet/receipt details are not included in its public record.
- A payment does not automatically issue a credential. An appropriately authorized organization must separately issue recognition.

**Evidence:** `src/lib/paid-actions.ts`; `/paid-projects/[id]`; `/paid-projects?view=mine`; `/payments`; `src/components/milestone-payment.tsx`; `src/lib/payment-chain.ts`, `payment-server.ts`; migrations paid projects, milestone payments, paid work history, payment workflow guards, public privacy and lifecycle.

**Tested:** entire isolated SQL workflow, unchanged offer facts, ownership, strict offline settlement fixtures, unique receipt credit, unknown-outcome locks, cancellation guards, public history consent/privacy and browser recovery request guards.

**Gaps:** locally saved signature versus cancelled/replaced unsigned attempt can become a recovery dead end; uncertain outcomes can need archival RPC/operator review; pending cancellation requests can remain historically pending after project completion, though the UI marks them no longer actionable; unselected applicants encounter an unavailable page after withdrawal rather than a closure notice. No amendments, escrow, refunds, dispute adjudication or real-money service exists.

## 4. Cross-feature integration matrix

| Connection | Current finding | Evidence and test scope |
|---|---|---|
| Challenge approval → achievement | Connected; separate claim/evidence snapshot | `review_assessed_submission`, `snapshot_new_achievement`; SQL workflow and legacy tests |
| Approved assessment → credential | Connected by explicit action, not automatic issuance | `issue_challenge_credential`; SQL + REST permission/source tests |
| Category permission → issuance | Database-enforced, including direct insert paths | `audit_credential_issuance` trigger; issuer SQL/REST bypass tests |
| Staff identity → private issuance audit | Connected; public provenance exposes coverage, not staff ID | `credential_issuance_audit`, `credential_issuance_provenance`; SQL/REST tests |
| Staff identity → public revocation event | **Privacy gap:** actor UUID remains public for a visible credential | `credential_events_read` + table grant + `credential_events(*)`; extra isolated REST reproduction |
| Acceptance → Passport credential | Connected, requires acceptance, publication and public profile | `visible_credential`, `respond_credential`, `PassportCredentials`; SQL/REST + UI fixture tests |
| Assessment publication → public summary | Connected; shares structured manifest only with evidence consent | `credential_challenge_context`; assessment SQL/REST tests |
| Private profile → employer discovery | Correctly excluded from application search | `search_passports`; discovery SQL/REST tests |
| Opt-out → shortlist/contact | Search/shortlists hide candidate; company contact access is also gated; recipient retains their own request view | discovery policies and `visible_contact_requests`; SQL/REST tests |
| Accepted contact → useful next action | Linked opportunity works; unlinked request has no contact handoff | `/contact-requests` explicitly records interest only |
| Cancellation → payment safety | Protected; cannot cancel signed/unknown transfers or waive approved unpaid work | `change_paid_lifecycle`, `cancel_unsigned_payment`; SQL tests |
| Cancellation → closed worker activity | Connected via RLS-protected closed rows merged into the worker's own listing | `/paid-projects/page.tsx`; SQL closed-party visibility; actual hosted list not tested |
| Completed payment → Passport history | Connected through separate worker/company choices; no automatic credential | `initialize_paid_work_history`, `share_paid_work`, `consent_paid_work`; SQL consent tests |
| Query failure → Passport presentation | **Reliability gap:** missing sections can look like absence of records | `PassportCredentials` and `PassportPaidWork` return null on database error |
| Historical proof → current verification | Format-compatible in automated tests | `proof-record.ts`, `proof.ts`, `credential-proof.ts`; legacy SQL + unit fixtures; no real historic hosted signature checked here |

## 5. Solana: meaningful functionality and remaining limits

### Where transactions actually occur

1. **Achievement integrity:** `src/components/proof-anchor.tsx` prepares a versioned Memo, requests Wallet Standard transaction signing, submits devnet bytes, waits for finalization and saves through `/api/proofs`. `src/lib/proof-record.ts` and `proof.ts` preserve historical v1/v2 meanings.
2. **General credential integrity:** the same component's credential mode uses `/api/credential-proofs`, `credentialClaim`, deterministic v3 serialization/hash and `proofpak:v3:<hash>`. A linked credential-issuer wallet must be authorized for that organization. Existing v3 claim fields are not retroactively changed. Assessed-source commitment is embedded in the existing committed `program_name` field, verified against the stored source context when available.
3. **Milestone payment:** `/api/payments` prepares an exact integer SPL TransferChecked transaction with a pinned destination and Memo commitment. The owned company payer signs. Signed bytes are validated and registered before application broadcast. `reconcilePayment` independently reads finalized chain data and invokes server-only receipt storage.
4. **Ownership linking:** nonce-based Ed25519 message signature, not an onchain transaction or email login. `/api/wallets`, `wallet-ownership.ts` and wallet SQL guard expiry, consumption, identity, purpose and membership.

### What is checked

- Devnet genesis and allowlisted token mint/program/decimals. Mint constant: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, classic Token Program, six decimals. This audit did not revalidate its live RPC state; the runtime payment path checks it before paying.
- Finalized successful transaction, expected Memo/hash and signer for proofs.
- Registered exact transaction bytes/signature, source authority/account, recipient ownership, mint/program/amount/decimals, historical token balance movement and intended instruction layout for payments. Underpayment, overpayment or unrelated transfers do not satisfy the milestone.
- Unique receipts prevent a signature/milestone from being credited twice. Unknown history after expiry remains `needs_review`, not assumed failed. Only strict server settlement marks paid.

**Main evidence:** `src/lib/solana.ts`, `credential-solana.ts`, `credential-verification.ts`, `payment-chain.ts` (`validateSignedPayment`, `verifyPaymentSettlement`), `payment-server.ts` (`reconcilePayment`); relevant API routes and unit tests.

### What Solana does not establish

A Memo provides independently inspectable evidence of a record commitment by a signer at a time. It does not establish legal issuer identity, university accreditation, assessment quality or actual skill competence. Payment proves a particular token transfer, not skill or dispute resolution. Most product state, identity approval, privacy, acceptance, revocation and agreement logic remain in Supabase and ProofPak's server. A visitor currently depends on the app/database for the claim and latest revocation state.

### Recovery and operational limits

- The payment path is more durable than proof anchoring: `ProofAnchor` obtains/persists the signature **after** `sendRawTransaction` returns. If submission succeeds but the acknowledgement is lost, the app may have no saved signature. Derive/save the signed transaction signature before broadcast; consider a durable proof-attempt record. Preserve existing versioned formats.
- The payment browser guard persists after local signing. If registration fails and an unsigned preparation is cancelled, that guard may outlive the cancelled server attempt. The recovery button only handles `prepared` attempts, and guard cleanup only handles `paid`/`failed`. An expired attempt can also fail registration. Do not fix this by blindly clearing storage or marking nonpayment; implement a verified recovery/disposition path.
- The protected cron handles at most eight attempts, sequentially, with a 60-second maximum route duration. A single finalized-history fetch can wait 15 seconds, with additional RPC requests. Several slow attempts can consume the whole run. On thrown errors the catch does not advance `checked_at`; repeated trouble can occupy the first batch again. The daily schedule is not a strong automatic settlement SLA. This is a code-based operational risk, not a measured hosted outage.
- Preview cron execution and `CRON_SECRET` must be verified separately. Manual authenticated reconciliation remains available.

**Useful future Solana work:** portable signed credential envelopes plus current-status/revocation references; documented issuer key rotation and recovery; durable proof attempts and robust reconciliation. Prioritize those over a custom program. Onchain escrow is not necessary to fix current reliability and would add funding, dispute, audit and legal obligations. Mainnet is a separate project, not a config flip.

### Wallet support and required manual evidence

Normal linking uses supported Phantom/Solflare extension or mobile in-app-browser methods. Unsupported phone QR pairing remains blocked; a generic wallet marketplace is not the normal connection path. `wallet-connection.ts` selects the named Wallet Standard provider. Reown code remains dynamically available only for legacy session handling.

Real device tests must still verify connection, locked/rejected wallets, nonce signing, organization purpose, disconnect/replacement guards, Memo signing, test-token signing, rejection, refresh, submitted-but-unknown recovery, finalization and no duplicate settlement. Automated Ed25519 and transaction fixtures are not physical wallet tests. No transactions were broadcast in this review.

## 6. Migration compatibility and safe release order

The fresh ordered PostgreSQL suite passed. The direct REST suite also passed. Two separate populated legacy upgrade scenarios preserved old v1 and v3 records; unit tests cover v1/v2/v3 serialization and matching logic. This is not proof that an unknown hosted schema has the same grants, functions or data integrity.

| Order | Migration file | Purpose/dependency |
|---:|---|---|
| 1 | `202610110001_initial.sql` | Auth-trigger profiles, companies/memberships, projects, challenges, submissions, reviews, achievements and initial proofs/RLS |
| 2 | `202610120001_passport_foundation.sql` | Versioned achievement snapshots/evidence/sharing, profile guidance/project evidence; preflight integrity checks are important |
| 3 | `202610120002_organizations_credentials.sql` | Organization/issuer administration, direct credentials, consent, revocation and qualification requests |
| 4 | `202610120003_credential_proofs.sql` | v3 credential proof records and recording |
| 5 | `202610120004_wallet_ownership.sql` | Signed ownership, wallet purposes, linking/unlink guards |
| 6 | `202610120005_paid_projects.sql` | Paid projects, applications, immutable offers, milestone work/reviews |
| 7 | `202610120006_milestone_payments.sql` | Payout authorizations, payment intents/attempts/receipts and wallet locks |
| 8 | `202610120007_paid_work_history.sql` | Completed work snapshots with recipient/company/evidence consent |
| 9 | `202610120008_payment_workflow_guards.sql` | Applicant finalization and party cancellation of unsigned preparations |
| 10 | `202611050001_paid_project_public_privacy.sql` | Fixed public project/milestone views, private underlying operational rows; aborts on unexpected read grants/policies |
| 11 | `202611050002_issuer_trust.sql` | Credential category permissions, private representative audit, approval history and safe public provenance |
| 12 | `202611050003_challenge_assessments.sql` | Rubric/review snapshots, explicit source-linked issuance and public consent-filtered context |
| 13 | `202611050004_employer_discovery.sql` | Directory/contact opt-ins, private shortlists, consent-based contact and search RPC |
| 14 | `202611050005_paid_project_lifecycle.sql` | Draft corrections, withdrawal/cancellation, private decision events/requests |

### Important deployment compatibility points

- Public paid pages now query `public_paid_projects` and `public_paid_milestones`. **New code before privacy migration means missing-view failures.** Older raw-table public queries stop finding opportunities after the privacy boundary. Coordinate the transition; do not weaken RLS to support stale code. A compatibility release or authorized maintenance window may be needed if no coordinated cutover exists.
- Existing authorized issuers receive **no new categories automatically** in the trust migration. Their historical credentials stay readable, but new issuance needs a deliberate administrator category review. Old issuer-approval clients grant no categories rather than bypassing the new rules.
- New credential queries embed `credential_issuance_provenance` and `credential_challenge_context`. A partially migrated database can fail even where the original credentials table exists.
- New dashboards need discovery columns/functions; new paid detail pages need lifecycle tables. Missing tables can become page errors or, in some Passport sections, misleading empty output.
- The REST harness intentionally postpones the privacy migration while seeding/validating upgrade conditions. That is a test design, **not the recommended release order**. The main fresh database suite applies the full ordered chain.
- All migrations are forward-only files, individually transactional. Existing files were not rewritten during this audit. Apply only confirmed missing migrations after backup, identity checks, preflights and approval; do not rerun the initial migration.

### Preview prerequisites

1. Create/identify a **separate** Supabase test project and recovery export. Do not reuse production user records or service-role credentials.
2. Configure a stable Vercel preview origin on the intended branch/SHA. GitHub push/deployment still needs explicit authorization. No preview was created or confirmed here.
3. Supply that test project's URL, publishable key and server-only service-role key. Set `NEXT_PUBLIC_SITE_URL` to the stable preview origin. Configure Supabase Auth Site URL and exact callback redirects, including `/auth/callback` and the recovery query flow used by `sendReset`.
4. Confirm email delivery/confirmation, correct callback origin and independent browser sessions. Keep deployment protection unless separately authorized otherwise; Vercel protection is distinct from ProofPak login.
5. Configure browser and server **devnet** RPCs with appropriate CORS/history. Reown ID is optional for legacy recovery, not a QR prerequisite. Keep `PROOFPAK_E2E` unset.
6. Apply reviewed missing migrations in order to the test project. Recheck grants/RLS, old row counts and retained signatures; authorize an independent administrator fixture through the approved manual bootstrap process.
7. Test two separate company/individual accounts plus a non-conflicted test administrator. Use small test-token amounts only after explicit transaction authorization.
8. Record source SHA, deployment Ready status, project identity, journey evidence and actual transaction links. Existing instructions in `docs/PROOFPAK_PREVIEW_TEST_PLAN.md` are preparation, not completed validation; extend them to the later trust/assessment/discovery/lifecycle migrations.

No usable isolated hosted project or stable test URL was confirmed. The previously supplied `https://pak-proof.vercel.app/` is production, not evidence of isolation.

## 7. Security and dependency findings

### Confirmed boundaries that passed

- Public paid-project views exclude `worker_id`, `current_offer_id`, `payout_authorization_id` and private milestones/submissions/receipts; raw records are party-limited. REST tests exercise direct column queries and filters, not just UI hiding.
- Ordinary users cannot grant issuer status/categories, impersonate another company, issue unsupported types or alter immutable credential facts. Staff attribution comes from `auth.uid()`. An administrator cannot approve an organization they belong to.
- Candidate search is server-side and opt-in; private notes and requests are organization-isolated; counts/filters exclude hidden evidence. Contact duplicate/spam limits are database enforced.
- Wallet ownership requires a fresh, expiring, one-time server message signature and proper purpose/organization permission. Connected address alone is not verification. Payer and credential-issuer permissions remain separate.
- Settlement uses server-only verification and unique immutable receipts. No client “mark paid” action was found. Unknown outcomes remain locked. No historical proof format was changed by this audit.
- Sensitive service-role operations are in server modules/routes. `.env.example` contains names/placeholders, and no application/environment file was edited. This was not a full historical Git secret-forensics audit.

### Newly confirmed privacy issue: revocation staff UUID

**Evidence:** `202610120002_organizations_credentials.sql` defines `credential_events.actor_id`, grants anonymous SELECT on the whole table, and uses `credential_events_read` with `visible_credential`. `src/lib/credentials.ts` embeds `credential_events(*)` although its TypeScript presentation type lists only event type/reason/date. TypeScript does not remove JSON columns.

**Reproduction:** an additional temporary harness under `/tmp` reran the complete isolated REST suite, revoked a disposable published credential as its authorized representative, and anonymously selected `credential_events?credential_id=eq.…&select=actor_id`. The returned UUID matched the fixture representative. Only a boolean confirmation was logged—no private real data. The container was disposable; no repository tests or hosted records were changed.

**Impact:** unnecessary exposure/correlation of staff account identifiers on public revocations. Not an authentication bypass, private-email leak or disclosure of every private credential. Public revocation reasons are already intended for display; distinguish approved public reasons from private administrative notes in the repair.

### npm audit results (registry response during this review)

| Scope | High | Moderate | Critical | Total affected package entries |
|---|---:|---:|---:|---:|
| `npm audit --json` | 18 | 15 | 0 | 33 |
| `npm audit --omit=dev --json` | 18 | 7 | 0 | 25 |

These are affected package entries, including transitive/metavulnerability propagation—not 33 independently demonstrated exploitable bugs. Both audit commands exit 1 because advisories remain. No Next.js advisory was returned for installed 16.4.5 in this run; production build had no security halt. This is a point-in-time result, not a guarantee of future safety.

| Root advisory-bearing package | Installed version/path | Advisory and relevance |
|---|---|---|
| `bigint-buffer` | 1.1.5, transitive Solana/SPL path | Buffer overflow in `toBigIntLE`; [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg). Runtime graph; exact deployed native binding/input reachability needs investigation. |
| `follow-redirects` | 1.16.1 via Axios/Reown ecosystem | Cross-realm sensitive-header redirect issue; [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p). No application credential-leak exploit reproduced. |
| Nested `zod` | 3.25.76 under Coinbase SDK; 3.22.4 under Reown wallet | Oversized constrained collection memory exhaustion; [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Top-level app Zod is 4.6.6; nested versions remain affected. |
| `stream-json` | 1.9.1 through Jayson/Solana dependency path | Nested-input DoS, JSONC scanning and prototype-pollution audit entries: [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x), [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc). Affected installed range is confirmed; actual used parser paths were not exploit-tested. |
| `uuid` | 8.3.2 transitive | Missing bounds checks for specific v3/v5/v6 buffer use; [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Application exploitation not established. |
| `minimatch` | Development TypeScript/ESLint dependency path | Globparts amplification DoS; [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Development/tooling exposure differs from normal deployed request handling. |

Top-level Reown packages and Solana web3 are flagged through affected dependencies; many wallet paths are legacy/dynamic, but “not the default flow” is not proof of non-reachability. Audit reports no compatible automatic fix for some top-level packages. Do not force-upgrade or override incompatible Zod/Solana major versions. A targeted dependency-reachability/removal/upgrade task is required with transaction serialization and wallet regression tests.

### Potential risks, not proven exploits

- Authenticated wallet challenge/proof/payment-check endpoints lack a general application rate limiter; origin/auth checks do not stop a malicious authenticated user from generating workload. Contact requests have stronger SQL quotas. No DoS attack was performed.
- External evidence URLs are references, not immutable document-content verification or a managed private upload system. A public URL can change contents after issuance; a URL digest does not freeze the referenced webpage.
- Trust depends on the administrator's actual review process, issuer staff access and centralized current-status records. No automatic accreditation, legal identity proof or institutional registry lookup exists.
- Reconciliation time budget/fairness and missing live observability are operational risks. No hosted cron failure was claimed.

## 8. Usability and state consistency

Existing navigation is substantially clearer than the earlier product. Home/profile/opportunities/activity/credentials are primary; wallet/settings remain secondary. Request-scoped caching, section-specific data selection, mounted layouts, loading routes and active/pending link feedback remain present (`portal-data-needs.ts`, `dashboard-navigation.ts`, `portal-nav.ts`). No broad dashboard redesign is justified.

Focused problems remain:

1. **Absence versus failure:** Passport credential/work-history errors return null, and credential detail errors can produce 404. Users may infer their work disappeared or the URL is invalid when a migration/network issue occurred.
2. **Credential correction:** the UI says revoke and issue a replacement, but linked same-type issuance cannot pass the source uniqueness constraint. There is no structured replacement reference/status chain.
3. **Recovery disposition:** a safe lock can become an unresolvable UI lock after cancelled/replaced unsigned preparation or expired local signature registration. Preserve safety while providing a real next step.
4. **Unlinked contact acceptance:** interest is recorded with no next communication action. This is disclosed, but the employer journey is incomplete for requests without an opportunity.
5. **Notifications:** users must manually revisit credentials, activity, contacts and paid project pages. No unified event inbox or workflow email delivery was found beyond authentication emails.
6. **Team access:** organization owners are told to arrange membership, but no complete invite/revoke UI/RPC workflow exists. A real institution cannot safely onboard staff through product UI alone.
7. **Closed opportunity context:** selected workers retain private closed records; unselected applicants can lose their detail-page context after withdrawal. A privacy-safe closure notice is preferable to a dead end.
8. **Limits and wording:** some generic mutation errors still collapse validation/status/setup failures; search caps can look like a complete catalogue. No automatic matching/ranking, bounty payments or formal assessment appeals are implemented.
9. **Institutional identity correction:** reviewed organization identity is locked in SQL; a controlled re-review/edit workflow is not a complete owner-facing feature. This protects trust but needs an operational support procedure.
10. **Public privacy wording:** published information remains public beyond the directory; profile privacy also has legitimate targeted company-review access. Explain these scopes without promising deletion from the blockchain or every cache.

## 9. Automated validation and evidence limits

All commands were run against current code. No application changes were made to make checks pass.

| Check | Actual result |
|---|---|
| `npm run lint` | Passed; zero reported lint errors |
| `npm run typecheck` | Passed |
| `npm test` | **73 passed / 0 failed / 0 skipped** |
| `npm run format:check` | Passed |
| `npm run test:db` | **11 SQL workflow/upgrade suites passed / 0 failed / 0 skipped**. Suite count, not assertion count. |
| `npm run test:privacy` | **36 passed / 0 failed / 0 skipped**, disposable PostgreSQL/PostgREST and fixture JWT roles |
| Additional privacy probe | Complete 36-test REST suite passed again, followed by one successful reproduction of the public revocation actor UUID finding. This is confirmation of a vulnerability, not a passing privacy guarantee. |
| `npm run build` | Passed: compiled, TypeScript completed, static generation finished; no `SecurityFatalError` |
| `npm run test:e2e` | **147 passed / 5 failed / 0 skipped**, 152 tests, approximately 6.3 minutes. Failures listed below. |
| Browser retry | **5 passed / 0 failed / 0 skipped** using `--last-failed --workers=1`, approximately 29.3 seconds including test-server startup. No application or test assertions changed. All 152 cases have passed across the initial run plus this targeted retry, but the initial full run was not wholly green. |
| `npm audit` | Exit 1; 33 affected package entries |
| `npm audit --omit=dev` | Exit 1; 25 affected package entries |

### Browser failures in the first run

- Desktop `credentials.spec.ts`: workspace requires real configuration at 320px—redirect expectation timeout.
- Mobile `credential-detail.spec.ts`: certificate facts/checks/details—interaction timeout.
- Mobile `credential-detail.spec.ts`: acceptance/publication privacy controls—interaction timeout.
- Mobile `dashboard-journeys.spec.ts`: new-user journey at 320px—profile action timeout.
- Mobile same journey at 390px—profile action timeout.

The original full run used two workers. Only these failures were retried with `npm run test:e2e -- --last-failed --workers=1`, with the same Chromium and localhost proxy bypass. The first run also overlapped local checks/a supplemental Docker fixture. That is a possible resource-contention contributor, **not a demonstrated root cause**. Do not erase the first-run failures or equate a successful retry with a wholly green initial run.

### What these tests do and do not establish

- SQL uses a lightweight local Auth schema/roles, not hosted GoTrue/email or Vercel runtime behavior.
- REST tests exercise real PostgREST permissions and bypass attempts on disposable fixture records, not production data.
- Browser tests use explicitly offline UI fixtures and unconfigured-auth guards. They are not logged-in full-stack user journeys against a real Supabase test project.
- Wallet tests include real cryptography/transaction serialization on fixtures, but no physical extension approval or devnet broadcast.
- A passing build does not prove hosted configuration, exact applied migrations, SMTP delivery, RPC history availability, legal issuer identity or successful real payment.
- No live page, production migration status, deployment Ready status or actual historical production signature was confirmed here.

Temporary logs under `/tmp/task8-*` record this session's command outputs. Initial failed browser error contexts were retained under `/tmp/task8-initial-browser-errors`; those are offline fixtures, not real account evidence. These paths are workspace-session artifacts, not permanent published audit evidence.

## 10. Prioritized gap analysis

“Fix” repairs or completes an existing claim/workflow. “New” introduces additional capability. Complexity is relative, not a delivery estimate.

| ID / priority | Problem, evidence and why it matters | Proposed action / kind | Complexity / dependencies | Acceptance criteria |
|---|---|---|---|---|
| **P0.1** Public revocation staff ID | Public `credential_events` grant/policy and `credential_events(*)` return `actor_id`; independently reproduced in isolated REST. Staff audit privacy is incomplete. | Safe fixed public revocation projection; private full event audit; update reads/relations without changing events or historical hashes. **Fix.** | Medium; credentials, public verification, consent RLS; additive reviewed migration | Anon/unrelated REST cannot select/filter/embed staff IDs; public revoked status/reason/date still work; staff/admin audit and private credential rules remain intact. |
| **P0.2** Security dependency disposition unresolved | npm audit: 25 runtime affected entries including 18 high; main still declares old Next. Installed advisories are confirmed; application exploitation is not. | Targeted graph/reachability analysis; remove unused legacy SDK code if compatible, or patch supported dependencies. No blind force fix. **Security fix.** | Medium–Large; wallet compatibility and exact serialization tests | Audit deltas documented; each remaining runtime advisory has evidence-based disposition; no new security build halt, hash change or wallet/payment regression. |
| **P0.3** No verified release baseline | No isolated hosted schema/Auth/preview/device journey confirmed; current shell points at production. Main does not contain the five new migrations. | Prepare authorized isolated preview, reviewed migration cutover and recorded acceptance gates. **Release validation**, not a new product feature. | Medium; P0.1/2 review, founder accounts/devices, preview authorization | Exact SHA/project/domain verified; four journeys complete with real accounts; authorized finalized devnet receipts/proofs independently checked; production remains untouched until approval. |
| **P1.1** Recovery lock dead end | `milestone-payment.tsx`: milestone guard set after signing; cleanup only paid/failed; recovery button only prepared. Cancelled/replaced/expired unregistered attempts can strand saved bytes. | Introduce explicit verified recovery/disposition using original bytes/signature and current attempt state; never blindly clear locks or infer nonpayment. **Fix.** | Medium; payment API/state machine, wallet locks, reliable historical RPC | Test registration failure → refresh → cancellation/replacement/expiry; original transfer reconciles if present; ambiguous state stays locked; proven safe terminal outcome permits explicit recovery without duplicate transfer. |
| **P1.2** Proof signature durability | `proof-anchor.tsx` persists only after send acknowledgement. RPC timeout after broadcast can lose recovery reference. | Derive/save signed signature before broadcast; consider durable versioned proof attempt storage; recover same signature. **Fix.** | Medium; v1/v2/v3 proof API compatibility | Simulate successful send with lost response: refresh finds original signature, no second transaction offered, eventual finalization/save works; historical hashes unchanged. |
| **P1.3** Linked credential correction blocked | Source table `unique(submission_id,credential_type)` and UI's “issue replacement” instruction conflict after revocation. | Explicit immutable supersession/correction link with controlled same-source replacement and active-duplicate protection. **Fix/completion.** | Medium; issuer permissions, consent, historical proof semantics | Revoke typo credential, issue linked corrected same-type replacement, independently accept/publish, verify both history and current replacement; retries cannot duplicate; old hashes verify unchanged. |
| **P1.4** False empty/404 on data failure | `PassportCredentials`/`PassportPaidWork` return null on errors; credential detail turns query error into notFound. Users cannot distinguish empty from broken. | Fail-safe section-level unavailable/retry states and redacted diagnostics. **Fix.** | Small–Medium; shared Passport/record components | Inject missing relation/network/permission errors: explicit unavailable state, no private leakage, no invented “zero credentials”; genuine missing/private credentials stay indistinguishable publicly. |
| **P1.5** Employer contact lacks handoff | Accepted unlinked request only records interest. `/contact-requests` confirms no chat/contact detail exchange. | Decide minimal recipient-approved next step: link a valid opportunity or a consented contact channel, without automatically releasing email or building a social network. **Workflow completion/new small capability.** | Medium; contact consent, privacy and spam quotas | Two accounts can proceed from accepted request to a clear authorized next action; decline/withdraw never releases contact data; unrelated companies cannot access it. |
| **P1.6** Reconciliation operability | Daily batch eight, sequential RPC, 60s duration, error paths do not advance check timestamp. Recovery throughput/fairness can degrade. | Budgeted fair queue, error backoff/last-checked bookkeeping and redacted monitoring; preserve strict settlement. **Fix.** | Medium; cron/RPC plan, immutable receipts | Simulate slow/failing first eight attempts; later attempts eventually checked within run budget; no duplicate receipt or payment; retries retain signatures and unknown state. |
| **P2.1** Staff onboarding gap | Membership schema supports owner/reviewer, but client membership writes prohibited and organization UI tells users to arrange access. | Controlled invitations, role changes/removal, last-owner protections and issuer/payer revocation implications. **New management capability.** | Medium; membership, wallets, audit | Owner invites staff safely; reviewer cannot grant ownership; removed member cannot issue/pay/access future private records; historical attribution remains. |
| **P2.2** Missing event visibility | Credentials, selections, reviews, contact and payment changes require manual revisits; no unified notifications. | Small event inbox first, privacy-safe optional delivery later. **New integration.** | Medium; existing immutable events and recipient authorization | Correct recipient sees action and deep link; deduplicate retries; no unrelated-org/private evidence disclosure; no claims of email delivery until tested. |
| **P2.3** Closure/status explanations | Withdrawn opportunities disappear for unselected applicants; cancellation requests can outlive completion; safe locks need actionable diagnostics. | Consent-safe closure projection, terminal request status presentation and concise state-specific next steps. **Fix.** | Small–Medium; lifecycle, application visibility | Applicant learns opportunity closed without worker/payment IDs; completed project cannot accept pending cancellation; same-side confirmation remains denied. |
| **P2.4** Abuse controls/observability | Expensive authenticated RPC-backed endpoints lack a general quota; public verification performs live chain checks. No attack demonstrated. | Scoped rate limits, body/work budgets, safe short-lived verification caching and redacted error IDs. **Hardening.** | Medium; hosting/auth/RPC integration | Excess caller load is bounded without bypassing legitimate recovery or returning stale “verified” after revocation; no secrets in logs. |
| **P2.5** Directory/privacy semantics and scale | Public profile table remains enumerable despite directory opt-out; opportunities cap 100/type and filter locally. | Clarify scopes; if non-listability is required, design slug-safe public projection/RPC; add real opportunity pagination. **Clarification plus optional access/scale change.** | Medium; public sharing contract, search, RLS | App and documented privacy match; private profiles never leak; opt-out API expectation explicitly tested; opportunities beyond first 100 can be found if pagination added. |
| **P2.6** Stronger trust operations | Approval is manual note-based review; no formal appeals, issuer identity update/key rotation or public verification methodology. | Document review standards first; add controlled appeals, identity re-review and key lifecycle. **Process/new workflows.** | Medium–Large; administrator policy and institutional agreements | Clear scope/accreditation disclaimers; attributable decisions; no self-approval; historical credentials/proofs survive suspension/rotation and remain separately labeled. |
| **P2.7** Credential portability/evidence durability | App/database provide claim/status; evidence digest commits a salted URL, not document contents. | Export portable signed claims with versioned status references and consent-safe evidence digests/storage. **New capability.** | Large; issuer-key governance, privacy, standards choice | Independent verifier can validate exported signed record and current status without overstated accreditation; private documents are not put onchain; old versions still work. |
| **P3.1** Bounties and real-money work | No true bounty/prize settlement, escrow, refund process or mainnet launch readiness. | Defer until complete direct-payment journey and real user demand; separate legal/security project. **New.** | Large; operational support, audits, legal/compliance and demand | Explicit rules/funding/disputes; no test-token earnings claims; independent mainnet release approval. |
| **P3.2** Advanced professional features | Dedicated experience management, general recipient invitation claims, ATS integrations, recommendations and full messaging are not complete. | Prioritize only after employer/student validation; keep Passport central. **New.** | Medium–Large; user evidence and consent design | Each capability improves a demonstrated journey, with scoped privacy tests; no marketplace-first rebranding. |

## 11. Release gates and next work

### Top five recommended development tasks

1. **Fix public revocation attribution exposure** (P0.1). Smallest concrete privacy boundary repair; add anonymous column/filter/embed tests.
2. **Resolve runtime dependency advisories deliberately** (P0.2), including whether legacy Reown dependencies can be safely retired. Keep supported wallets and serialization intact.
3. **Close payment/proof recovery edge cases** (P1.1/P1.2) using original signed attempts and durable signatures, without unsafe financial retries.
4. **Implement controlled linked-credential correction/supersession** (P1.3), with old proof compatibility and recipient consent.
5. **Complete a minimal consent-safe employer contact handoff** (P1.5), without a full messaging or recruitment platform.

Run the isolated preview release gate in parallel when the founder is available; it is not optional merely because more development can continue. Failure-versus-empty states and reconciliation operability are close follow-ups and should be fixed before a reliability claim.

### Minimum real-account release demonstration

- **Passport:** fresh email signup/confirmation, profile/project editing, explicit publish, independent browser, then privacy withdrawal.
- **Challenge/credential:** second company account creates rubric/challenge; individual submits/revises; company approves achievement; non-conflicted administrator grants only needed categories; separate linked credential issued; recipient accepts/shares; authorized issuer wallet anchors; public page checks real finalized v3 proof. Challenge approval alone is not a credential.
- **Discovery:** individual opts into discovery/contact; company searches, shortlists and requests contact; recipient declines/accepts; change privacy and verify company access disappears. Note unlinked acceptance currently has no handoff.
- **Paid work:** company publishes; individual applies/accepts; links and authorizes payout; submits milestone; company reviews/approves; original authorized payer signs a small devnet test-USDC payment after separate permission; strict server receipt and history consent verified; repeat reconciliation does not double credit. Test rejection, refresh and unknown outcomes separately.

### Claims safe to make now

“The workflows are implemented and have substantial isolated automated coverage.”

### Claims not justified now

“Production is fully tested,” “all security vulnerabilities are resolved,” “the issuer is legally accredited,” “blockchain proves the skill is true,” “payment is guaranteed,” “test USDC is real earnings,” “QR pairing works,” or “a real devnet transaction was tested in this audit.”

**Final decision:** keep the present unified product architecture. Repair the specific privacy and recovery gaps, resolve dependency risk and establish a reproducible isolated hosted demonstration before expanding features. No architectural rebuild or new Solana program is justified by this review.
