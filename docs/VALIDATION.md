# Validation record

Validated in the cloud workspace using Node 24.19.0, Next.js 16.4.0, Solana JavaScript SDK 3.0.2, and PostgreSQL 17.

## Executed successfully

- The exact saved install script: frozen dependency install with `npm ci`, TypeScript check, ESLint, unit tests, and production build.
- Seven automated unit tests: canonical record serialization and SHA-256, tamper detection, matching signer/memo/success requirements, safe evidence URLs, review validation, and actual SDK transaction construction/signing/serialization. The signing test is offline; it does not represent a transaction broadcast to devnet.
- PostgreSQL integration using the actual migration: create company and challenge, submit, request improvements, revise, approve, issue one achievement, and publish a passport. Assertions reject direct talent approval, self-review, another company’s access/approval, duplicate approval, client proof insertion, and anonymous access to private profiles.
- Desktop and mobile browser checks: two landing-page paths, responsive navigation, filtering/details, all 16 demo/public/portal routes, no horizontal overflow or runtime browser exceptions, honest empty achievement states, and signup errors without credentials. These are explicitly demo-only checks; they do not validate hosted Supabase accounts or wallet extensions.
- Production dependency audit after migrating away from the legacy Solana SDK: no reported vulnerabilities.

## Not yet validated against live services

- Hosted Supabase Auth email delivery, callback, session refresh, API-backed create/read/update/review operations, and the deployed RLS configuration. The SQL itself was tested locally; apply it to your Supabase project before signing up.
- Phantom/Solflare extension connection and signing in a real browser with a funded devnet wallet.
- Broadcasting a transaction, saving its proof through hosted Supabase, and verifying it against the live devnet RPC.
- Vercel deployment and a newly restored/published cloud environment.

No transaction signature has been fabricated or recorded as evidence of a live test. The environment’s initial request to `api.devnet.solana.com` was rejected by its egress proxy (HTTP 403). The configuration draft now contains the required domain additions, but saving that draft does not apply/publish it.

## User prerequisites

Provide the Supabase URL/publishable key and server-only service-role key securely in environment settings; apply the migration to a fresh project; configure auth redirects; review/save the network additions and publish the environment. Then follow `docs/DEMO.md` with two accounts and a wallet holding devnet SOL. Verify a finalized transaction and its live matching record before calling the entire MVP demo complete.

## Operational follow-up

The existing `4aae9df` implementation was retained. Runtime checks now establish that all six variables are present, Supabase keys are usable, email signup is enabled with confirmation required, and both configured RPCs reach the real devnet genesis hash. Values and user records were not printed.

The hosted API reports all ten application tables and the three workflow functions missing. A read-only SQL inventory and safe, numbered migration/auth/wallet instructions are in `docs/GO-LIVE.md`. No hosted migration was executed. The account listing returned no users; no test account or blockchain transaction was created.

Fixed cloud proxy use in the Node startup commands, the truncated devnet genesis constant, a PostgreSQL test startup race, error-page retry behavior, and the landing page's failure when the challenge query is unavailable. Signup now refuses to create an account when the profile schema is unavailable; that guard was verified in the browser against the live configured environment.

The browser suite previously cleared public variables only at startup, which is insufficient after a credentialed Next.js build. It now creates its own blank-credential `.next-e2e` build and checks the demo notice before signup. This does not alter the live application's data source. All ten desktop/mobile tests passed after isolation was corrected. Eight unit tests and the actual local PostgreSQL approval/access-control integration passed. Production compilation, TypeScript, lint, and formatting checks passed.

Live rendered checks: landing, How It Works, signup, and signin load; both portals redirect signed-out visitors to signin. Explore Challenges and public passports accurately report the missing database; they are not operational yet. The real account-to-approval-to-wallet flow remains blocked until the hosted schema is initialized and the dashboard redirect/mail settings are confirmed.
