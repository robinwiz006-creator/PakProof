# ProofPak

A digital skill passport for emerging talent, with a company workspace for practical challenges and evidence-based reviews. Built with Next.js App Router, TypeScript, Tailwind CSS, Supabase, and Solana devnet.

For the passport-first release, follow [Phase 1 implementation and manual upgrade](docs/PHASE-1-PASSPORT.md) before merging or deploying. Existing databases need the additive migration only; do not rerun the initial migration.

For a safe checklist to activate the existing implementation, see [Get the MVP operational](docs/GO-LIVE.md). Run `npm run doctor` for read-only service checks.

## Credentials and optional wallets on this branch

See [credentials/wallet delivery and manual setup](docs/CREDENTIALS-WALLETS-DELIVERY.md). This branch adds authorized organizations, direct credentials, recipient consent, private degree verification requests, v3 devnet proofs, and signed wallet ownership. The three new migrations are **unapplied** by this task. Stages 6–8 are now connected: see [paid-project/payment delivery and manual setup](docs/PAYMENTS-MVP.md). Paid projects use devnet test tokens only; new migrations remain unapplied by this task. No new feature is claimed tested in production.

## What you can use now

- Responsive landing page, How It Works, searchable challenge browser and details.
- Talent dashboard, editable/private-by-default profile, project evidence links, submissions and feedback, skill passport, unique public profile URL.
- ProofPak company workspace company profile, challenge publishing/closing, submission review, improvement requests, approval, candidate directory, and dashboard counts.
- Atomic database approval creates an immutable achievement. A separate Wallet Standard flow supports Phantom and Solflare to sign a real Solana devnet memo transaction. The server verifies the finalized transaction before storing a proof. The verification page recomputes the record hash and checks the live chain.
- Labeled demo content when Supabase is not configured. Demo content is read-only and contains **no company-approved achievements or fake blockchain transactions**.

This implementation is ready for connecting live services, but a hosted Supabase login + wallet + devnet end-to-end run has **not** been completed in the cloud workspace. See [validation results](docs/VALIDATION.md) and [demo walkthrough](docs/DEMO.md).

## Run the site without accounts

You need Node.js 24 LTS and npm. This workspace was tested on Node 24.19.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open the local development server shown by Next.js. Leave the Supabase fields empty to browse the demo. Forms clearly explain that real saving requires Supabase; no account or submission is silently simulated.

## Connect real accounts and data

1. Create a project at [Supabase](https://supabase.com). Save its database password securely; the application does not need that password.
2. In the Supabase SQL Editor, run the complete contents of `supabase/migrations/202610110001_initial.sql` **once on a fresh project**. This creates the tables, signup trigger, row-level policies, and protected review functions. Do this before registering users.
3. From Supabase Project Settings → API, copy your project URL and publishable key into `.env.local` (or deployment/environment settings):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (a legacy anon key also works)
4. To save verified blockchain proofs, add `SUPABASE_SERVICE_ROLE_KEY` from the project’s legacy API keys. This is a **server-only secret**. Never prefix it with `NEXT_PUBLIC_`, commit it, or paste it into chat. Normal profile/challenge/review operations do not use this key.
5. In Supabase Authentication → URL Configuration, set the site URL and allow your site’s `/auth/callback` URL. For local development, use `http://localhost:3000/auth/callback`. For Vercel, use your deployed HTTPS URL. Set `NEXT_PUBLIC_SITE_URL` to the matching origin.
6. Keep email/password authentication enabled. With email confirmation enabled, users must confirm the email before signing in. Configure an SMTP provider for reliable delivery outside a small hackathon demo. We do not bypass confirmation in application code.
7. Restart Next.js after updating environment settings.

If users existed before the migration, their profiles must be provisioned by an administrator; the signup trigger applies to new accounts. Start the demo with new accounts created after the migration.

### Network requirements

The cloud environment must allow `registry.npmjs.org`, your Supabase project hostname (`<project-ref>.supabase.co`), `api.devnet.solana.com`, and `explorer.solana.com`. A custom RPC provider needs its own domain added. Browser wallets also need their normal connectivity. The saved draft includes Supabase and Solana domain additions; saving the draft does not itself apply the policy.

## Solana: real proofs, explicit limits

No platform signing key is used. Install Phantom or Solflare, enable devnet, and obtain devnet SOL through the wallet or [Solana faucet](https://faucet.solana.com). Devnet SOL has no monetary value. Wallet Standard signs serialized bytes, so the app does not rely on legacy wallet compatibility with SDK transaction classes.

- `SOLANA_RPC_URL`: server-only devnet RPC, default `https://api.devnet.solana.com`.
- `NEXT_PUBLIC_SOLANA_RPC_URL`: browser devnet RPC, same default. Do not put a private provider credential into a browser variable.
- Both routes check the devnet genesis hash. Mainnet endpoints are refused.
- Approval issues an achievement, **not** an onchain proof. The company reviewer then selects a wallet and anchors it. A failed or missing transaction remains pending.
- The memo contains only `proofpak:v1:<sha256>`. Canonical JSON contains version, achievement ID, challenge ID, company ID, and issuance timestamp. It excludes names, emails, talent IDs, URLs, and private evidence. Timestamp normalization uses UTC millisecond precision and fixed key order.
- The server requires company membership, a successful finalized transaction, the exact memo program/hash, and the recorded signing wallet. Only the server writes `blockchain_proofs`; clients cannot insert proofs or achievements.
- If a transaction was sent but storage failed, use **Retry saving existing transaction**. The browser saves the pending signature and wallet locally, and the recovery fields accept them after a reload. Do not send a second transaction just to retry storage.
- A commitment proves that this opaque achievement record was anchored at a point in time. It does not independently prove the assessment is truthful or certify the company’s identity. Project content is not hashed by this version. Companies are self-registered, and the reviewer’s database membership authorizes proof registration; the signer wallet is not a separately certified legal company identity.
- Devnet can reset. The live verification page reports a missing transaction or RPC outage rather than claiming a match based only on the database.

We reviewed the [Solana Attestation Service](https://github.com/solana-foundation/solana-attestation-service). Its credential registration, authorized signer management, schema provisioning, and attestation lifecycle are valuable for a later version. The MVP uses the requested simpler hash anchor to keep the challenge/review/wallet demo tractable. See [architecture](docs/ARCHITECTURE.md).

## Validation

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:db       # Requires Docker; isolated PostgreSQL, no hosted credentials
npx playwright install chromium
npm run test:e2e      # Isolated demo build and production server on port 3100
```

If Chromium is already installed, use:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

The browser suite builds and launches with blank Supabase variables in its own ignored `.next-e2e` directory, independent of a developer’s live accounts. Public variables are captured at build time, so blanking only the startup environment is insufficient. It validates demo interactions and responsive layouts, not a hosted authentication or wallet transaction. The SQL suite creates test auth roles in an ephemeral local PostgreSQL container, applies the actual migration, and checks the approval flow and denied operations. It does not emulate Supabase email delivery or its API gateway.

## Deploy to Vercel

1. Push the working branch, create a pull request, and merge it into `main` after review (commands below).
2. Import `robinwiz006-creator/PakProof` into Vercel. It detects Next.js; the root is the repository root. Use Node 24 and the standard `npm run build` command.
3. Add the environment variables above in Vercel. Store `SUPABASE_SERVICE_ROLE_KEY` as a secret. Use your HTTPS deployment origin for `NEXT_PUBLIC_SITE_URL`.
4. Apply the Supabase migration, configure auth redirect URLs, deploy, and run the walkthrough in `docs/DEMO.md` with two separate accounts.
5. Confirm that the achievement has a finalized devnet signature and the verification page reports a live match before presenting the full onchain demo.

There is no onchain program to deploy and no private signing key to store on Vercel.

## Merge the working branch

The implementation is committed to `work`. To publish it from a machine with the branch:

```bash
git push -u origin work
```

On GitHub, open a pull request from **work → main**, review the changes, and select **Merge pull request**. If you prefer the command line after review:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff work
git push origin main
```

This task does not push or merge automatically. If the cloud UI creates a pull request for you, use that flow to get the committed changes onto GitHub.

## MVP boundaries

Project and supporting-document evidence uses external URLs; direct Supabase Storage uploads are deferred. There is no messaging, recruitment pipeline, recommendations, multi-company selector, membership invitation UI, project edit screen, or password-reset screen. Company profile editing is owner-only, while reviewers can publish and review challenges. The portal uses the first company for its profile/create screen and all existing memberships for review visibility; use one company per account for the demo. No live seed creates fabricated achievements: use the walkthrough to produce authentic test records and label the test company/profile as demonstration data.

Company identity vetting, wallet identity binding, production abuse/rate-limit controls, account recovery, and a durable production-chain policy should precede a public launch. This is a hackathon MVP, not a completed production trust system.

## Phase 1 passport foundation

The passport-first branch requires the additive `202610120001_passport_foundation.sql` migration before deployment. Do not rerun the initial migration or merge before reviewing the manual upgrade procedure. See [Phase 1 implementation and release guide](docs/PHASE-1-PASSPORT.md) for user journeys, v1/v2 compatibility, security tests, and exact Supabase/Vercel actions.
