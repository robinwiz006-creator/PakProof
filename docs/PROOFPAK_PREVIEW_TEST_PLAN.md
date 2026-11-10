# ProofPak safe preview and real-account test plan

Prepared 5 November 2026. **This is a preparation/evidence document, not authorization to deploy, migrate a hosted database, create hosted records, fund wallets, or broadcast transactions.** No application changes are required for this plan.

## 1. Current release state

| Item                               | Verified finding                                                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local branch                       | `fix-wallet-specific-connection`                                                                                                                                                                                                                                                         |
| Candidate                          | `25fa920e1311d8f48f24c653a046e84d125b5869`                                                                                                                                                                                                                                               |
| Security fix                       | `fba7181` is an ancestor; Next.js and eslint-config-next 16.4.5, React/React DOM 19.3.0. Lockfile retained.                                                                                                                                                                              |
| Privacy fix                        | `25fa920` adds `202611050001_paid_project_public_privacy.sql` and updates public readers.                                                                                                                                                                                                |
| GitHub main, freshly fetched       | `c92cf0a8b59b65c59ab94ac2224580c51f15c7b8`                                                                                                                                                                                                                                               |
| GitHub feature branch              | Still `96795c8858279506efd14f3c2875146a23a3298e`; it does **not** yet contain either fix or the later visual-consistency commit.                                                                                                                                                         |
| Difference from main               | Local branch has 3 unique commits (`e40ce26`, `fba7181`, `25fa920`); main has 4 unique merge commits. Main-only commits have no additional file changes. Read-only merge simulation completed without conflicts and produced the same tree as local HEAD. No merge/rebase was performed. |
| Uncommitted before this task       | Only pre-existing untracked `docs/PROOFPAK_PRODUCT_AUDIT.md`. No required application changes were pending. This new plan is also uncommitted; no commit/push was requested.                                                                                                             |
| Existing production                | `https://pak-proof.vercel.app/`; this is **not** a test preview.                                                                                                                                                                                                                         |
| Current Codex Supabase environment | Matches known production reference `wizlluiyhsxtsxpuwudc`; excluded from hosted workflow tests. Presence of its configuration is not test-environment readiness.                                                                                                                         |
| Preview URL / deployment           | No candidate preview URL or Ready deployment confirmed. GitHub deployment-status/PR API calls returned Forbidden, including the retry. No Vercel project link or Vercel token is available here. Git fetch works; that does not grant Vercel/Supabase control.                           |
| Separate hosted test database      | Not supplied or confirmed. No test keys or management access confirmed.                                                                                                                                                                                                                  |

The exact changes since main are the visual-consistency work in `e40ce26`, the focused security dependency changes, and the paid-project privacy boundary. The 38 changed files include shared navigation/style, credential presentation/inbox, wallet/profile presentation, their UI tests/docs, Next.js package/lockfile updates, public paid-project readers, one forward SQL migration, and privacy tests. Earlier homepage, dashboard performance, recipient full-URL lookup and wallet-specific fixes are preserved. Use `git log origin/main..HEAD` and `git diff --stat origin/main...HEAD` to reproduce the inventory.

Read together with:

- [Product audit](PROOFPAK_PRODUCT_AUDIT.md): historical audit; its blocked-build/privacy findings are superseded locally by Tasks 1–2, not proven fixed in production.
- [Security fix evidence](SECURITY-BUILD-FIX.md): patched build and remaining dependency advisories.
- [Privacy release guide](PAID-PROJECT-PRIVACY-RELEASE.md) and [read-only metadata checks](check-paid-project-privacy.sql).
- [Payment behavior and recovery](PAYMENTS-MVP.md). Older credentials delivery notes describe a checkpoint before payments existed; current source and later payment delivery take precedence.

## 2. Release order: keep production untouched

1. **Founder creates a separate empty Supabase test project**, confirms its reference is different from production, and records its identity.
2. Obtain explicit authorization for applying migrations to that **named test project only**. Complete the preflight below. Manually apply the entire chain to the empty test database, in order, including the privacy migration. Do not copy production records.
3. Verify schema, RLS and public projections in that test project before inviting accounts.
4. Configure Vercel **Preview** variables scoped to this feature branch, using only the test project's credentials. Inspect inherited Preview variables so none still point to production. Obtain the real stable preview origin and configure test Supabase Auth redirects.
5. Obtain explicit permission to push the branch and create a **Preview** deployment. Do not merge to main. On Vercel verify target environment, source branch and exact candidate SHA. A deployment of remote `96795c8` is not the fixed candidate.
6. If the stable preview alias was unavailable until deployment, obtain it from Vercel, finish its Preview-only site URL and test Auth allowlist, then explicitly authorize a rebuild/redeploy of the candidate. `NEXT_PUBLIC_*` values are baked into browser assets; changing them alone does not update an existing deployment. Do not start signup testing while these settings are incomplete.
7. Founder authorizes creating synthetic records/accounts in this test project. Run no-wallet journeys and permission checks first.
8. Obtain separate explicit authorization for the real devnet proof and tiny test-token transfer. Only then run wallet/chain steps. Wallet connection/ownership signing alone is not a blockchain transaction.
9. Record evidence and resolve failures. A production release needs separate approval, database preflight/backup, coordinated migration and deployment, and production verification.

**Why this order matters:** new public readers require the two new public views. Old readers need raw-table public SELECT, which the privacy migration removes. There is no unsafe fallback. A fresh isolated preview can receive all SQL before its first deployment. An eventual production upgrade must coordinate SQL and code in a maintenance window; neither an old deployment after restricted SQL nor new code before the views exist is a compatible public-reader pair. Do not restore the vulnerable grants to fix a deployment problem.

## 3. Founder setup: isolated services

### 3.1 Supabase test project

1. In Supabase, choose **New project**, name it clearly (for example `ProofPak Preview Test`), choose your organization and region, and retain the generated database password privately in a password manager. Do not send it in chat.
2. Wait until it is ready. In **Project Settings → General**, copy its project reference. It must **not** be `wizlluiyhsxtsxpuwudc`. In **SQL Editor**, check that the address bar/project header is this test project before every write.
3. Do not restore a production backup or import production users. Keep the test project empty until the authorized migration walkthrough.
4. In the test project's **Connect / Settings → API Keys**, obtain its project URL, publishable key and the legacy **service_role JWT** expected by this application's server. Store these privately in Preview settings. Do not use the production service-role key, an SQL password as an API key, or the public key as the server key. If the expected server key format is not available, stop and validate SDK/key compatibility rather than guessing.
5. Keep RLS enabled. Do not create broad temporary policies to make testing work. Do not add test-only fixtures or `tests/database-bootstrap.sql` to hosted Supabase; the platform already provides auth roles and `auth.users`.
6. Retain migration filenames, timestamps and successful outcomes in a private operator log. A new empty project has no production recovery risk; before adding valuable test records, retain an appropriate manual export/recovery point. For any reused nonempty test project, obtain a usable backup first.

### 3.2 Vercel Preview only

1. Open the existing PakProof project in Vercel. Confirm its Git repository is `robinwiz006-creator/PakProof` and production branch remains `main`.
2. Open **Settings → Environment Variables**. Scope test settings to **Preview**, and where supported restrict them to `fix-wallet-specific-connection`. Never edit Production values. Inspect Preview defaults and branch overrides, not just Production settings.
3. Configure the variables below before building. Never paste secret values into this document, chat, GitHub, browser code or screenshots.
4. After push/deployment approval, use the deployment from this non-main branch, or Vercel's **Create Deployment** action selecting this branch and **Preview**. Do not redeploy an old commit and call it the candidate. If UI wording differs, verify environment and SHA on the deployment details before proceeding. Do not click Promote to Production.
5. Record its immutable deployment URL, stable branch alias and source commit. Use the stable alias consistently for account testing, ownership signatures, evidence links and auth callbacks. A generic `*.vercel.app` string or the production URL is not sufficient.
6. Confirm status **Ready**, inspect redacted build/runtime errors, and confirm `next` 16.4.5. A green GitHub check for another SHA is not evidence for this candidate.
7. Preserve deployment protection. Give testers authorized Vercel access if needed. Test an authorized incognito visitor with no **ProofPak** session; Vercel protection may still ask for Vercel login. Do not call that a broken public passport or silently disable protection. If truly unauthenticated public sharing is required, authorize a suitable test access configuration separately.

| Variable                               | Preview value/source                                            | Exposure and requirement                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | New test project's URL                                          | Public; required. Must not use production project.                                                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same test project's publishable key                             | Public; required; RLS remains the privacy boundary.                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY`            | Same test project's legacy service-role key                     | Server-only; required for ownership, proof recording and settlement. Never `NEXT_PUBLIC_`.                                      |
| `NEXT_PUBLIC_SITE_URL`                 | Exact HTTPS stable preview origin, no trailing slash/path       | Required for confirmation/resend/recovery links; never production or localhost for hosted tests.                                |
| `SOLANA_RPC_URL`                       | Reliable Solana **devnet** RPC                                  | Server-only; can contain a private provider key. Must provide finalized transaction/token metadata.                             |
| `NEXT_PUBLIC_SOLANA_RPC_URL`           | Browser-accessible Solana **devnet** RPC                        | Public endpoint/key only; HTTPS and browser CORS must work. Never expose a private provider credential here.                    |
| `CRON_SECRET`                          | New test-only random secret, generated privately                | Server-only; optional for manual walkthrough; required if testing protected reconciliation job. Do not reuse production secret. |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`         | Leave unset unless deliberately testing legacy-session recovery | Not required for supported Phantom/Solflare extension or wallet in-app-browser flow. No new QR/marketplace testing.             |
| `PROOFPAK_E2E`                         | **Unset**                                                       | `/test-ui` must not become a hosted real-account testing path.                                                                  |

No wallet private key/seed phrase, USDC mint environment override, platform admin environment flag, or email-password account setting is required in the app.

`vercel.json` defines a daily `/api/payments/reconcile` job. Do not assume Vercel Cron runs on Preview; scheduled jobs normally run on Production deployments. Manual authorized **Check/save existing transaction** recovery is the preview path. Do not change production cron settings. Node must satisfy `>=24.19.0 <25`; check Vercel's actual build runtime and `npm ci`/`npm run build` output against the lockfile.

### 3.3 Auth/email on the test project only

1. In test Supabase **Authentication → Sign In / Providers → Email**, enable email/password signup and keep email confirmation required. Do not weaken production settings or disable confirmation to obtain a green result.
2. Under **Authentication → URL Configuration**, set **Site URL** to the stable preview origin, denoted `https://PREVIEW_HOST` below.
3. Add exact permitted redirect URLs:
   - `https://PREVIEW_HOST/auth/callback`
   - `https://PREVIEW_HOST/auth/callback?purpose=recovery`
     If a specific immutable preview host or authorized localhost run will also be tested, allow its exact callback URLs deliberately. Do not allow every unrelated `vercel.app` deployment.
4. Keep confirmation/reset templates compatible with Supabase's standard confirmation link (`{{ .ConfirmationURL }}`). Do not replace the callback with a direct dashboard link or an unsupported token-hash flow: this code exchanges a PKCE `code` at `/auth/callback`.
5. Use three separate controlled email inboxes or aliases that actually receive mail. Supabase's default mail sender can restrict recipients to authorized project-team addresses and has tight limits; check current Auth email delivery limits/logs. For external testers configure approved **test-project** custom SMTP and its sender/DNS, or restrict initial testers to recipients supported by the default sender. No SMTP secret belongs in Next.js public variables.
6. Signup/confirmation and password-reset links should be opened in the **same browser profile** that requested them, because the PKCE verifier belongs to that browser's cookies. Use separate browser profiles for each account; incognito is for checking public access after publication. A link opened on another browser/device can fail even when the database is correct.
7. Test confirmation resend and password reset once; inspect Supabase test-project Auth logs without copying email tokens or session cookies into the report. If the callback goes to production, stop and fix Preview site URL/test Auth configuration before continuing.

### 3.4 Wallets, RPC and test asset

Supported primary methods: Phantom extension, Solflare extension, and their supported mobile wallet in-app browsers. QR pairing and generic Reown selection remain removed. Install only from `https://phantom.com/download` or `https://www.solflare.com/download/`. Wallets remain optional for passports, challenge submissions and receiving an ordinary credential.

Read-only verification in this task succeeded on the public devnet RPC:

| Check           | Actual result                                                   |
| --------------- | --------------------------------------------------------------- |
| Network genesis | Matches `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` (devnet) |
| Mint            | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` exists           |
| Owner program   | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` matches           |
| Mint layout     | 82 bytes; initialized; **6 decimals**                           |

This was `getGenesisHash` and `getAccountInfo`, not a transfer, faucet request, wallet test or proof of funding. Recheck both chosen RPCs before the funded walkthrough. Public RPC rate limits, provider availability and historical transaction metadata can still block settlement; do not weaken verification in response.

After explicit funding/transaction approval, use fresh test wallets, devnet SOL and **the exact mint above**. A token named USDC with another mint will not work. The app expects the payer's canonical associated token account; a faucet placing tokens elsewhere may require an independently authorized account consolidation, not a verifier change. A Circle/test issuer faucet may be an option if it currently supports this exact asset; no faucet availability is confirmed here. Do not use mainnet tokens. Devnet tokens have no monetary value or guaranteed redemption. Suggested project budget: **0.02 test USDC**, one milestone (20,000 base units). Allow additional devnet SOL for Memo fees, payment fees and associated-token-account rent; there is no fixed fee guarantee. The payer can create a missing recipient ATA through the prepared transaction.

Reown domain allowlisting is not a prerequisite for the current extension/in-app-browser flow. If legacy Reown recovery is intentionally included later, its public project ID, relay access and allowed preview origin must be checked separately; it must not reintroduce unsupported phone QR pairing.

## 4. Hosted test migration preflight and sequence

**Do not execute these steps until the founder authorizes the named test project.** A fresh project is preferable to copying production or trying to reconstruct unknown hosted migration history.

### 4.1 Before any application SQL

In the confirmed new test project's SQL Editor, run read-only checks:

```sql
select count(*) as existing_auth_users from auth.users;
select tablename from pg_tables where schemaname='public' order by tablename;
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' order by p.proname;
select t.tgname from pg_trigger t
where t.tgrelid='auth.users'::regclass and not t.tgisinternal;
select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m','S') order by c.relname;
```

Expected: zero auth users and no ProofPak tables, views, functions, sequences or auth-user trigger. Platform extensions/functions may exist; inspect them, do not delete them. If application objects/users exist, stop and determine what succeeded already; do not rerun initial SQL. The project reference in Supabase must independently match the recorded test reference—SQL success alone cannot establish project identity.

### 4.2 Apply full files once, in this exact order

| Order | File in `supabase/migrations/`                 | Purpose / dependency                                                                                                                                                  |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `202610110001_initial.sql`                     | Profiles/auth trigger, companies/memberships, projects, challenges/submissions/reviews, achievements/v1 proofs. Only for the confirmed empty test project.            |
| 2     | `202610120001_passport_foundation.sql`         | Profile/project additions, achievement claim/evidence/sharing snapshots and v2 support. Requires initial schema and integrity checks.                                 |
| 3     | `202610120002_organizations_credentials.sql`   | General organizations, independent administrator authorization, credentials/preferences/events and qualification requests. Reuses companies/memberships and profiles. |
| 4     | `202610120003_credential_proofs.sql`           | Immutable general credential/v3 proof receipts and authorized recording. Requires organization credentials.                                                           |
| 5     | `202610120004_wallet_ownership.sql`            | Nonces, linked purposes, ownership recording and protected disconnect. Requires organizations.                                                                        |
| 6     | `202610120005_paid_projects.sql`               | Paid projects, applications, offers, milestones/reviews and guarded workflow functions.                                                                               |
| 7     | `202610120006_milestone_payments.sql`          | Payout authorization, payment intents/attempts/receipts, locks and settlement guards. Requires paid projects and wallet links.                                        |
| 8     | `202610120007_paid_work_history.sql`           | Completed work with separate company/worker/evidence consent. Requires settlement model.                                                                              |
| 9     | `202610120008_payment_workflow_guards.sql`     | Finalize other applications on acceptance; controlled unsigned-payment cancellation. Requires 005–007.                                                                |
| 10    | `202611050001_paid_project_public_privacy.sql` | Fixed public opportunity views and party-only raw access; required by current public readers.                                                                         |

Paste each **complete file**, including its transaction, and record success before moving on. Do not paste test bootstrap/fixture SQL, create synthetic auth rows manually, reset the project, or apply all files to production. SQL Editor execution may not create Supabase CLI migration-history rows; retain the manual ledger and inspect actual schema. If a connection is interrupted, confirm whether the transaction committed before retrying.

Use stage-specific read-only checks at the appropriate time:

1. Before file 2: `docs/check-phase-1.sql`: three relations absent, no existing new-column rows, integrity-review count zero; on the fresh project there are zero achievements/proofs.
2. Before files 3–5: `docs/credentials-wallets-preflight.sql`: no conflicting objects and all three prerequisite booleans true. After file 5: `docs/credentials-wallets-validation.sql`: 11 RLS-enabled tables, 14 named functions, 6 enabled triggers; proof/ownership recording functions are service-only.
3. Before files 6–9: `docs/payments-preflight.sql`: no conflicts and four prerequisite booleans true. After file 9: `docs/payments-validation.sql`: 12 RLS-enabled tables, expected workflow/server privileges, both unique live-payment indexes.
4. Before and after file 10: `docs/check-paid-project-privacy.sql`: before, base tables exist and public views do not; after, both views exist with fixed fields, trusted owner, security barrier and owner execution. Anonymous restricted-column privileges must be false; authenticated raw policies use project/milestone-party helpers. On the fresh database, record counts remain zero.
5. Do not run an earlier preflight after that phase is installed and mistake expected existing objects for migration failure. Validation and preflight have different purposes.

The privacy migration deliberately runs public views with their trusted owner's rights. A generic Supabase security-definer-view warning may therefore appear; see the privacy release guide. It is not permission to convert the views blindly to invoker mode or broaden raw SELECT. Extra permissive policies or inherited anonymous column grants can cause the migration to abort for review.

### 4.3 Final hosted privacy acceptance

Complete with **synthetic preview records** after account setup. Preserve metadata/counts and outcomes, not raw private evidence, access tokens or service-role responses.

| Actor / condition                                                                          | Expected hosted result                                                                                                                                | Actual     |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Anonymous homepage / `/opportunities` / `/paid-projects`                                   | Published open project and company name visible; no fabricated fallback.                                                                              | NOT TESTED |
| Anonymous published/offered/active/completed detail                                        | Public brief and milestone scope/amounts only. Draft inaccessible.                                                                                    | NOT TESTED |
| Anonymous direct `public_paid_projects?select=*`                                           | Only fixed public columns; never worker/offer/payout IDs.                                                                                             | NOT TESTED |
| Anonymous direct `paid_projects?select=worker_id,current_offer_id,payout_authorization_id` | Permission denied (commonly HTTP 401 for anonymous); no records.                                                                                      | NOT TESTED |
| Explicit restricted view column/filter                                                     | Rejected (normally HTTP 400), not silently returned.                                                                                                  | NOT TESTED |
| Anonymous `public_paid_milestones?select=*`                                                | Only id/project/position/title/deliverables/deadline/amount; no submission/approval IDs or work status.                                               | NOT TESTED |
| Unrelated signed-in account                                                                | Raw projects/milestones empty, own applications/offers only; safe public views work.                                                                  | NOT TESTED |
| Owning company member                                                                      | Own raw project/milestone/application records accessible, including drafts; cannot read another company's private records.                            | NOT TESTED |
| Selected worker                                                                            | Relevant offered/active private project and permitted records accessible; loses raw project access if offer declined; old own offer remains readable. | NOT TESTED |
| Submission/evidence/payment receipt                                                        | Denied to anonymous/unrelated users even when project is completed. Parties retain permitted access.                                                  | NOT TESTED |
| Public views POST/PATCH/DELETE                                                             | Permission denied; no mutations.                                                                                                                      | NOT TESTED |
| All status changes                                                                         | Public projection remains safe; private identifiers never appear because status changed.                                                              | NOT TESTED |

For actual REST checks, use the test project's API URL and publishable key. Anonymous requests need `apikey`, with no service-role Authorization header. The key is public but do not paste operational requests containing private user JWTs into the shared report.

```powershell
# Windows PowerShell, test project only. Both prompts are public configuration.
$testApi = Read-Host 'Test Supabase URL (https://TEST_REF.supabase.co)'
$testPublicKey = Read-Host 'Test project publishable key'
$headers = @{ apikey = $testPublicKey }
Invoke-RestMethod "$testApi/rest/v1/public_paid_projects?select=*&limit=3" -Headers $headers
# Expected permission error; never substitute a service-role key:
Invoke-RestMethod "$testApi/rest/v1/paid_projects?select=worker_id,current_offer_id,payout_authorization_id&limit=1" -Headers $headers
# Expected missing-column error:
Invoke-RestMethod "$testApi/rest/v1/public_paid_projects?select=worker_id&limit=1" -Headers $headers
```

These commands return only safe public fixture data on success. Do not screenshot private authorization headers. For signed-in actors, use that actor's actual authenticated requests in browser **Developer Tools → Network**, or a local API client with the actor's private access token kept in a private variable. Reissue the restricted raw/view requests against the **same test Supabase origin**. Do not use a service-role token to prove RLS, and do not paste sessions into ChatGPT/Codex. Record actor, endpoint, HTTP status, row count/field names only. SQL role simulation supplements this but does not replace authenticated REST/UI tests.

## 5. Accounts and test records

Create all users through the **preview signup UI and real email confirmation**, after approval. Do not reuse production accounts/records or publish real qualifications.

| Label | Role / browser                                   | Purpose                                                                                                                                                   |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Independent administrator; browser profile A     | Platform review only; **not** a member of the test organization.                                                                                          |
| B     | Organization owner; browser profile B            | Register clearly labeled `ProofPak Preview Test Organization`, create opportunities, review work, issue after approval, sign issuer/payment transactions. |
| C     | Individual; browser profile C                    | Passport, challenge work, applications, credentials and payout wallet.                                                                                    |
| D     | Optional unrelated individual; browser profile D | Negative access tests; required to test isolation from both company and selected worker.                                                                  |

Record only account labels, non-sensitive test UUIDs/slugs and roles in the private test ledger—**no passwords, recovery phrases, session tokens or confirmation links**. Use synthetic names/evidence that belong to the tester. Do not claim to be an actual university, Superteam or a real winner.

Test administrator bootstrap is not automatic. After explicit authorization, the test project owner copies **A's test Auth user UUID** and manually runs in the **test** SQL Editor:

```sql
insert into public.platform_administrators(user_id)
select id from auth.users where id = 'ADMIN_TEST_USER_UUID'::uuid
on conflict (user_id) do nothing;
```

This intentionally writes one test authorization record; it must not be executed without the requested approval. A then reviews B at `/issuer-admin`, opens the organization detail, records a private truthful note such as “Synthetic preview organization; approved for isolated workflow testing, not real-world institutional identity,” and confirms approval. Before approval, B's issuance must be denied. An admin cannot approve an organization they belong to. This demonstrates controlled platform authorization, not real-world university verification.

## 6. Journey A — Skill Passport (no wallet)

**Actual status: NOT TESTED on preview.** Existing local profile/privacy tests pass; they do not prove email delivery or hosted sessions.

1. C opens the preview homepage, chooses **Build Your Passport**, registers as an individual with a controlled email and a password of at least 10 characters. Expected: clear confirmation instruction; no fabricated successful session.
2. Open confirmation in the same browser profile. Expected: test Supabase callback returns to preview `/portal/talent`, never production. Sign out/in once; refresh to confirm session persistence.
3. Choose **Build my profile / My Profile** → guided setup `/portal/talent/profile`: About me, skills, projects, preview/publish. Enter a synthetic name, unique lowercase slug (e.g. `preview-student-20261105`), headline and optional biography/location/university. Skip optional information once; return and save it.
4. Add skills such as React and SQL. In `/portal/talent/projects`, add a real tester-owned sample project with title, description and at least one valid GitHub/demo/evidence URL. Edit it; confirm one record remains, not a duplicate. An evidence link is required by this form; a wallet/challenge/credential is not.
5. Open `/portal/talent/preview`; confirm saved facts, skills, project and links. Use `/portal/talent/profile?step=publish` to publish deliberately. Copy the resulting `/talent/[slug]` URL.
6. Open that preview-origin URL in another browser with no ProofPak session. Expected: only permitted public records. Make the passport private, reload the anonymous URL, and confirm it is unavailable; publish again for later credential lookup tests.
7. Test `/resend-confirmation` with a separate pending test signup and `/forgot-password` → callback `?purpose=recovery` → `/reset-password`. Confirm the new password works and old one does not; record outcomes without email tokens.

Evidence: screenshot of the completed preview passport, published public URL, privacy denial outcome, and redacted Auth/email result. Failure gates: missing trigger/profile, callback to production, session loss, duplicate project on edit, or private profile publicly accessible.

## 7. Journey B — Challenge, achievement and separate credential

**Actual status: NOT TESTED on preview; v2/v3 chain steps NOT TESTED with real wallets.**

1. B signs up with company preference, confirms email and opens `/organizations?view=register`. Create the synthetic organization; do not create an unnecessary duplicate company if reusing the owned company. Expected: pending approval, membership visible only to B and authorized workspace users.
2. Attempt credential issuance while pending. Expected: unavailable/denied, with no credential created. A completes the independent approved test review above. B reloads: approved for credential issuance; ordinary unrelated users cannot access private organization management or admin notes.
3. B opens `/portal/company/create`. Publish a clearly named **Preview Test — Accessible Profile Challenge**: future deadline, Beginner difficulty, React/accessibility skills, practical description and explicit deliverables. This is an unpaid skill challenge; no invented prize.
4. C discovers it at `/opportunities` → challenge detail `/challenges/[id]`, submits a tester-owned project/GitHub URL and explanation. Expected: pending submission in My Activity/submissions. No wallet required.
5. B opens `/portal/company/reviews`, requests improvement with feedback. C sees feedback and resubmits; B approves. Expected: challenge-based **achievement** is created on C's achievements/passport according to evidence privacy. Approval alone does **not** create a general organization-issued credential, acceptance request, payment, or finalized chain proof.
6. B separately opens `/organizations?view=issue`. Use C's **full preview public passport URL**, then test slug entry on a separate credential if needed. Enter “Preview Test — Accessible Interface Recognition,” type **Company achievement**, accurate test description, issue date, optional program/award, and safe evidence URL. Expected: private credential pending recipient acceptance; issuer facts cannot be edited by C. A private/nonexistent slug must not be accepted or expose arbitrary accounts.
7. C opens `/my-credentials`, **View Credential**, then returns to **Decision & publication settings** on My Credentials. Accept, explicitly choose publication and separately choose evidence sharing. Confirm accepted-but-unpublished remains private; then opt in and confirm public passport display. Test Decline on a separate disposable credential; it must not appear publicly.
8. After separate wallet/transaction approval, B links a **Credential Issuer** wallet for this approved organization at `/wallet` (ownership message first). In `/organizations?view=issued`, use that matching Phantom/Solflare wallet to anchor the accepted/current credential. Sign the real v3 Memo; keep the signature and retry saving the **same** transaction until finalized verification succeeds. Recipient needs no wallet for this credential.
9. C or a logged-out visitor opens `/credentials/[id]`. Expected: actual title, permitted recipient, issuer, dates and separate acceptance/validity/organization-approval/blockchain-integrity states. Only a matching **finalized** real transaction can show confirmed integrity. Open the real Explorer link with `?cluster=devnet`.
10. On an expendable second credential, test revocation (and an already expired test credential if desired). Current validity must show revoked/expired without rewriting the old claim/transaction. For corrections, revoke and issue a separate replacement mentioning the original; no formal automatic replacement relation is implemented.
11. Optional separate v2 regression: B anchors the challenge **achievement** from `/portal/company/reviews` using the existing achievement proof action, then inspect `/verify/[achievement-id]`. This is another real transaction requiring approval. Do not call the v3 credential proof a v2 achievement proof; old v1/v2 formats must remain unchanged.

Evidence: test organization/admin decision outcome (private note not published), challenge/submission/achievement IDs, credential URL, consent matrix, original transaction signature, finalized Explorer link and public verification screenshot. No fabricated institutional endorsement or automatic skill-truth claim.

## 8. Journey C — Opportunity discovery and selection

**Actual status: NOT TESTED on preview.** Paid-project offer acceptance exists; challenge candidate selection/offer acceptance is a different concept and is not implemented as a recruitment flow.

1. B creates the test challenge above and a separate paid-project draft at `/paid-projects/new`. Enter scope, requirements, skills, deadline, budget and milestones whose amounts exactly equal the budget. Review then publish from `/paid-projects/[id]`.
2. Logged-out visitor and C open `/opportunities`, search the synthetic title/company/skill, and filter **All**, **Challenges**, **Paid Projects**. Expected: only published open listings with real links; unpaid challenges are distinct from devnet-budget projects. Test a no-match search and an empty project before publishing.
3. C opens the paid-project detail. Expected: public scope, skills, dates and milestone budgets, no private applications/offers/wallet data. Click **Apply**, enter a meaningful pitch and valid evidence URL, submit once. Refresh and confirm a single application and correct status.
4. B opens project detail, reviews C's evidence and selects the worker. C sees the offer, reviews fixed terms/version and explicitly accepts. Expected: offered → active, one selected worker; other applicants are not selected. Decline on a separate throwaway project reopens it without exposing the previous worker's private records.
5. D opens the same project and tries private evidence/payment URLs/API reads. Expected: public brief only, unrelated raw reads empty/denied; D cannot select/accept/review on behalf of B or C. Own-company application is refused. Search must never expose private profiles or applications.

Evidence: listing/detail links, application ID/status, offered/accepted version, role-denial outcomes. There is no implemented bounty reward, messaging, shortlist or recruiter-offer flow to demonstrate as working.

## 9. Journey D — Paid work and finalized test-token payment

**Actual status: NOT TESTED on preview; real payment NOT TESTED. Requires separate explicit devnet broadcast approval.**

1. Reuse Journey C's accepted project with one **0.02 test USDC** milestone. Amounts are exact base units; no mainnet or real earnings. Terms are currently immutable even in draft; review carefully. No amendment editor, escrow, guaranteed funding, automated dispute/refund or active-project cancellation is available.
2. C links a **Personal** payout wallet at `/wallet` with a server-verified ownership message. On the active project's detail, use **Authorize your payout wallet** to pin that exact verified destination. Connection alone is not payout authorization.
3. C submits milestone explanation and evidence. B reviews, requests revisions once, C resubmits, B approves. Expected: **Work approved; payment due**, not Paid or Completed. Only the selected worker can submit; unrelated organization cannot approve.
4. B links an **Organization → Company payer** wallet as the company owner. A Personal or Credential Issuer link is insufficient. Ensure the selected extension account matches the verified payer and the chosen test organization. Account C and payer B must have different wallet addresses.
5. After funding/broadcast authorization, B clicks **Prepare and review payment**. Confirm exact mint, 0.02 test USDC amount, destination, devnet, and separate devnet SOL fee/rent. If source tokens/SOL are missing, stop and fund externally only with approval; do not weaken checks or substitute another token.
6. Click **Sign and pay exact amount** and approve in the real wallet. Expected: signed bytes/signature are validated and registered server-side **before** browser broadcast. If registration fails, do not manually send a new transfer.
7. Wait, then use the existing check/save action if necessary. Expected: Pending/Needs review while uncertain; **Paid only after independent finalized transfer verification and a unique receipt**. Checks include mint/program/decimals, exact amount, payer authority, canonical accounts, recipient historical ownership, registered bytes/intent memo and successful finalization. A submitted signature or wallet success toast is not settlement.
8. Open `/payments` in B and C. Record the same original signature and Explorer link. D/anonymous cannot retrieve the private receipt, payout authorization or submission. Onchain wallet addresses/transfers are publicly discoverable even though in-app receipts and private terms are restricted.
9. Refresh after sending and **Check and save existing transaction** again. Expected: one receipt, no new payment. If the browser closed after registration before broadcast, the original payer may explicitly resume **the same signed transaction** while valid. If outcome is unknown/expired, do not prepare/send another payment; keep signature and investigate with archival devnet RPC.
10. After all milestones are approved and settled, project becomes completed. B grants company disclosure consent; C opts into public work history and separately approved evidence sharing. Published passport may show work/company/skills/evidence, not receipt/address/private contractual metadata. Project budget remains public in the opportunity listing; consent does not make the already advertised budget secret. Payment alone must not issue a credential or verify a skill.
11. Make C's profile private and/or withdraw sharing. Confirm completed work is hidden publicly; underlying agreements/receipts remain intact.

Evidence: accepted project/milestone IDs, approved state before payment, exact integer amount, original signature, finalized receipt timestamp, both accounts' receipt state, consent/public-profile outcome. Do not paste signed transaction bytes, private evidence URLs or user tokens into public artifacts.

## 10. Real-wallet test matrix (Phantom and Solflare separately)

Use a laptop extension for the first complete journey. For mobile, use the supported wallet in-app browser; email/password login still applies in that browser. There is **no supported desktop-to-phone QR pairing test** in this release. Do not add a QR workaround.

| Test                                   | Expected                                                                                                                                                                             | Phantom actual | Solflare actual |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | --------------- |
| Installed / missing extension          | Selected wallet opens directly; missing wallet shows its official install link/retry, no second marketplace.                                                                         | NOT TESTED     | NOT TESTED      |
| Both installed                         | Only selected provider connects.                                                                                                                                                     | NOT TESTED     | NOT TESTED      |
| Locked wallet / connection refusal     | Useful error/unlock/retry; no linked record merely from connecting.                                                                                                                  | NOT TESTED     | NOT TESTED      |
| Ownership message                      | Review preview origin, account, purpose, organization and expiry; approve once; server confirms verified link. No transaction/fee.                                                   | NOT TESTED     | NOT TESTED      |
| Signature rejection / challenge expiry | No verified link; retry requires a valid fresh challenge.                                                                                                                            | NOT TESTED     | NOT TESTED      |
| Wrong purpose/organization             | No silent switch or privileged action; company payer owner-only; credential issuer needs approved organization.                                                                      | NOT TESTED     | NOT TESTED      |
| Reload/reconnect                       | Linked server record persists; browser session may require reconnect; correct selected address retained/checked.                                                                     | NOT TESTED     | NOT TESTED      |
| Devnet                                 | Wallet displays test network; app independently checks RPC genesis. Ownership itself is network-independent, not proof of a devnet transaction.                                      | NOT TESTED     | NOT TESTED      |
| Credential Memo signing                | Real matching issuer signs; pending stays pending; finalized matching v3 proof verifies.                                                                                             | NOT TESTED     | NOT TESTED      |
| SPL token signing                      | Registered exact approved devnet transfer; finalized matching receipt only.                                                                                                          | NOT TESTED     | NOT TESTED      |
| Payment signing rejection              | No broadcast/Paid; unsigned preparation can be explicitly cancelled.                                                                                                                 | NOT TESTED     | NOT TESTED      |
| Refresh/save retry                     | Original signature/bytes recovered, one receipt, no repayment.                                                                                                                       | NOT TESTED     | NOT TESTED      |
| Session disconnect vs unlink           | Session disconnect does not erase verified association. Unlink needs permission; active agreements/unresolved payments can block it. Replacement requires a new ownership signature. | NOT TESTED     | NOT TESTED      |
| Mobile in-app browser                  | Selected provider, authenticated preview session and message signature work; no same-phone QR.                                                                                       | NOT TESTED     | NOT TESTED      |

For transaction rejection/cancellation testing, use the app's cancellation flow for an **unregistered** preparation. Never assume a signed/registered transaction is cancelled merely because the page closed. Do not deliberately send malformed/underpaid transfers from an external wallet as an acceptance shortcut; use offline fixtures for those negative settlement cases. Real failed chain transactions cost devnet fees and require separate approval if intentionally tested.

## 11. Evidence ledger and actual status

### 11.1 Hosted journeys

| Item                                                                   | Status       | Evidence / blocker                                                                        |
| ---------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| A: signup → public passport                                            | NOT TESTED   | Separate test project, preview domain and confirmation delivery not configured/confirmed. |
| B: organization → challenge achievement → separate accepted credential | NOT TESTED   | Needs test users, admin bootstrap/approval and test database.                             |
| B: real v3 finalized proof/public verification                         | NOT TESTED   | Real issuer wallet and explicit broadcast approval missing.                               |
| C: discover → apply → select → accept                                  | NOT TESTED   | Needs actual preview and two accounts.                                                    |
| D: approve → finalized token payment → consented history               | NOT TESTED   | Needs funded devnet payer, real wallet and explicit broadcast approval.                   |
| Hosted public/raw-table privacy                                        | NOT TESTED   | No hosted test database identified. Local PostgREST tests are not a substitute.           |
| Preview deployment Ready at candidate SHA                              | BLOCKED      | Candidate not pushed; no deployment authorization; status API Forbidden.                  |
| Production issue resolution                                            | NOT VERIFIED | Production has not been modified/tested by this task.                                     |

### 11.2 Fresh local checks in this task

Fresh commands completed successfully on 5 November 2026. These run against local code, disposable database containers or explicit local UI fixtures, **not** against production users. No `npm run doctor` was run with the production configuration: its legacy coverage also does not validate all newer schema/RLS boundaries.

| Check                                 | Actual result                                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint                                  | PASS; `npm run lint`, exit 0; no errors.                                                                                                      |
| TypeScript                            | PASS; `npm run typecheck`, exit 0; no errors.                                                                                                 |
| Unit tests                            | PASS; `npm test`: 60 passed, 0 failed, 0 skipped.                                                                                             |
| Formatting                            | PASS; `npm run format:check`, exit 0. This Markdown plan also checked separately.                                                             |
| Production build                      | PASS; `npm run build`, exit 0; no security halt.                                                                                              |
| Local database suites                 | PASS; `npm run test:db`: 6 suites passed, 0 failed, 0 skipped; disposable PostgreSQL only.                                                    |
| Local direct REST security suite      | PASS; `npm run test:privacy`: 14 passed, 0 failed, 0 skipped; 2 unsafe-schema rejection checks and populated-record preservation also passed. |
| Existing desktop/mobile browser suite | PASS; `npm run test:e2e`: 126 passed (63 desktop, 63 mobile), 0 failed, 0 skipped; fresh local test build/server, 4.4 minutes.                |
| Public devnet genesis/mint read       | PASS: expected devnet, program, initialized mint and 6 decimals; no transaction.                                                              |
| Git history compatibility             | PASS: clean merge simulation, identical HEAD tree; no actual merge.                                                                           |

The browser runner explicitly clears Supabase keys and uses the gated `/test-ui` fixtures. Payment and ownership unit tests include genuine **offline** cryptographic signatures and settlement fixtures; none are real wallet/provider or blockchain acceptance evidence. Isolated SQL tests use synthetic auth bootstrap only in disposable local containers.

No application, dependency, migration, production configuration or existing audit-report changes were made. This test plan is the only newly created deliverable and remains uncommitted.

Current task logs are under `/tmp/task3-*.log` and `/tmp/task3-devnet.json`; they are workspace-local artifacts, not durable deployment evidence. Do not attach raw auth/network logs containing secrets. Retain only redacted screenshots and transaction links after the authorized walkthrough.

### 11.3 Fill this after each authorized hosted run

- Date / tester / device / wallet version:
- Candidate source commit / immutable deployment URL / stable preview origin:
- Test Supabase project reference / migration ledger checked:
- Account labels used (never passwords):
- Journey or negative test ID:
- Expected outcome / actual outcome / PASS, FAIL or NOT TESTED:
- Screenshot artifact path (redact emails, tokens and private notes):
- Credential/project/milestone public test identifiers:
- Original transaction signature and `https://explorer.solana.com/tx/SIGNATURE?cluster=devnet` (only once real):
- Finalization/receipt result, retry count and duplicate-receipt count:
- Blocking error code/message (redacted), recovery action and next owner:

There are **no real-wallet screenshots, transaction links or preview screenshots** for this task. Do not fill placeholders with example signatures or claim green tests imply live readiness.

## 12. Blockers and production prerequisites

### Current blockers

1. Provided URL is production; no separate Supabase test reference or stable preview URL supplied.
2. Codex service keys currently target production and are deliberately excluded from hosted testing. No test project management access/credentials confirmed. Configure test secrets directly in Vercel Preview and, only if hosted automation is later authorized, a separate test-scoped environment; never send them in chat or overwrite production settings.
3. Candidate commits are local only. No push or preview deployment permission was granted by this task. GitHub API metadata access is Forbidden; no actual Ready preview can be confirmed.
4. Test migrations, synthetic users, independent admin bootstrap and email delivery require authorized setup.
5. Physical extension interaction, devnet funding and real proof/payment broadcast are not possible/authorized here. Manual tester and separate explicit approval required.
6. Remaining runtime dependency advisories from the Task 1 report are not cleared by build success. Scope/reachability and mitigation need review before broader real-user exposure. Preview must contain synthetic records only.
7. Existing product limitations remain: generic issuer authority/manual identity review, no automatic challenge-to-credential conversion, no bounty/prize model, notifications, agreement amendments, active-work cancellation, refunds, disputes or escrow. Unknown signed payment recovery may require reliable historical RPC/support. These are not implemented by this setup task.

### Before a production release

- Founder approves a reviewed release and separately approves the production migration, after confirming target project, usable backup/recovery point and actual existing migration state.
- All four hosted journeys pass with real confirmation emails; public/private access matrix passes against actual REST; issuer approval remains independent; account recovery/session handling works on the intended origin.
- At least one genuine v3 credential proof and one tiny devnet transfer finalize and independently verify; both supported wallet providers are tested or clearly disclosed as unverified/unsupported for the release.
- Refresh/recovery does not create duplicate payments; recipient/account/org wallet purposes and locks stay enforced; no unknown transfer is auto-repaid.
- Confirm production schema includes all required prerequisites and the privacy views, with no unexpected permissive policies/grants. Apply only missing reviewed migrations, never reset/rerun initial.
- Coordinate privacy SQL and matching code; keep protected records/signatures and recover forward on failure. Verify schema reload and public discovery after deployment.
- Check final repository/lockfile, no secrets, source SHA, production runtime, security advisories, production callback/RPC settings and actual deployment result. Do not copy test keys/accounts into production.
- Payments remain devnet test tokens with no monetary value. Platform authorization, credential validity and blockchain integrity stay separate; no proof of issuer honesty, real income or guaranteed payment is claimed.

## 13. Exact next founder action

**Create a new empty Supabase test project and share only its project reference.** In Vercel, identify/copy the stable branch preview URL if one already exists (the production URL is not suitable). Then explicitly authorize the named test-project migration/setup and, separately, pushing this feature branch and creating a Preview deployment with test-only settings. Do not approve a production merge or production migration for this exercise. Real devnet signing/transfer approval comes after no-wallet hosted acceptance passes.
