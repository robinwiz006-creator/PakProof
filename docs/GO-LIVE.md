# Get the existing MVP operational

These steps use the existing application and migration. No project rebuild or new Supabase key is needed based on the current checks.

## Current findings

- All six application variables are present. The Supabase public key can reach authentication settings; the service-role key can access the admin API. No credential values were printed.
- Email/password signup is enabled. Email confirmation is required. SMTP delivery and the dashboard redirect allowlist cannot be established from the public settings endpoint.
- The founder applied the initial migration manually and reported success. A subsequent read-only doctor run confirms all ten tables return HTTP 200 and all three workflow RPCs are exposed. Do not reapply the initial migration. Hosted RLS policies and trigger definitions require the SQL Editor check in DEPLOYMENT.md; REST schema checks cannot inspect those catalogs.
- No existing auth users were returned by the read-only admin listing.
- Both configured RPC endpoints respond with the complete Solana devnet genesis identifier. No transaction has been sent.
- The configured application origin is `http://localhost:3000`. That is a local-development URL, not a public demo deployment.

## 1. Check the database before applying anything

1. Open your Supabase project dashboard and select **SQL Editor → New query**.
2. Paste the contents of [`check-database.sql`](check-database.sql) and click **Run**. These are SELECT statements only; they change nothing.
3. If the application table, function, and signup-trigger results are all empty, proceed to step 2 below.
4. If **any** application table/function/trigger already exists, do **not** run the initial migration again. Retain your database and share only the table/function names or counts so the partially installed schema, exposure settings, or cache can be diagnosed. Never share user records or keys.
5. If there are existing authentication users, their profiles may need an administrator-reviewed backfill after the migration. The migration creates profiles automatically only for future signups. Do not delete accounts or reuse signup as a substitute for fixing a missing profile.

## 2. Apply the existing migration once, only to an uninitialized application schema

1. Create another **New query** in the SQL Editor.
2. Copy the entire file [`202610110001_initial.sql`](../supabase/migrations/202610110001_initial.sql), from `begin;` through `commit;`, into it.
3. Click **Run** once. The script is transactional: if an error occurs, do not repeatedly rerun pieces or remove constraints. Keep the error message (without user data) for diagnosis.
4. Run `check-database.sql` again. Expect all ten application tables, the three workflow functions plus the signup function, and the signup trigger. The RLS column must be true for all ten tables.
5. Back in Codex, run `npm run doctor`, or tell Codex the migration was applied so it can rerun the checks. This command only reads service configuration/schema metadata; it never applies migrations, creates users, or sends a transaction.

## 3. Configure authentication URLs

1. In Supabase open **Authentication → URL Configuration**.
2. For a developer running the app locally, set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to **Redirect URLs**.
3. For your public demo, deploy to Vercel first, then use the actual public HTTPS origin as **Site URL**. Add exactly `<your-public-HTTPS-origin>/auth/callback` as a redirect URL. Keep the local callback only if local development is needed.
4. Set `NEXT_PUBLIC_SITE_URL` in the matching application environment to that same origin, without a trailing slash. Rebuild/redeploy after changes to public variables.
5. Confirm **Authentication → Sign In / Providers → Email** is enabled. Email confirmation is currently required. Confirm your mail delivery settings/SMTP and use inboxes you can open for the two demo accounts. Do not disable confirmation in code or create fake successful signups.
6. Supabase's normal email-confirmation links support the app's PKCE callback. Open the confirmation in the same browser profile that initiated signup, so its verifier cookie is available.

No additional Supabase management token is required. Check the redirect allowlist in the dashboard because the app's publishable/service-role keys do not expose management settings.

## 4. Run and check the real application

1. Run `npm run dev`. The scripts now enable Node's environment-proxy support, which is necessary in this cloud environment. HTTPS and certificate verification remain enabled. Deployments with no proxy variables work normally.
2. The landing page, How It Works, and signup/signin pages should render. A missing challenge database is reported as unavailable on the landing page; no demonstration challenges replace the real query.
3. After the migration, run `npm run doctor`. All schema checks should pass. Open Explore Challenges; a fresh database honestly shows an empty list until a company publishes a brief.
4. Register one company account and one talent account using separate browser profiles or an incognito window. Confirm both emails. The unauthenticated portal redirects to sign-in. Signup checks for the profile schema first and refuses to create an account if it is unavailable, so missing setup does not leave a new account without a profile.
5. Follow [`DEMO.md`](DEMO.md) to create the company profile, publish a challenge, complete a talent profile, submit public project evidence, and approve the submission. Label the company/profile as hackathon demonstration accounts, even though their database records and transaction are real.

## 5. Complete the first real devnet transaction

1. Complete company approval first. The talent passport must show an actual achievement with **onchain proof pending**.
2. In the company browser, install/enable **Phantom** or **Solflare** with Wallet Standard support. Switch to devnet and obtain devnet SOL from the wallet or the official Solana faucet. Devnet SOL has no monetary value; no paid mainnet funds are needed.
3. Sign in as the reviewer who belongs to the challenge's company. Open **SkillBoard → Review Submissions** and find the approved submission.
4. Select your wallet and click **Connect wallet & anchor**. Review and approve the real devnet memo transaction in the wallet. Only the achievement record's hash is onchain; private evidence and personal details are excluded.
5. Wait for finalization and **Finalized Solana proof saved**. The server verifies the transaction before saving its signature, signer, hash, and timestamp in Supabase.
6. Open the achievement verification page. It must say **Onchain record verified** and link to Explorer on **devnet**. Check that the memo is `proofpak:v1:<hash>` and matches the page's recomputed hash.
7. If broadcast succeeds but saving fails, retain the transaction signature and signing wallet. Click **Retry saving existing transaction**, or enter them in the recovery fields after a reload. This does not send another transaction.
8. Visit the student's published profile signed out, then open the achievement and verify again.

This proves a record commitment. It does not certify company identity or prove that its assessment was truthful. Devnet history can reset.

## Remaining limitations

The application has not yet completed a hosted signup → submission → approval → wallet transaction run. The schema is now exposed; public deployment, dashboard auth settings, and the real two-account walkthrough remain to be completed. The existing local SQL test validates database logic in an isolated test database; the browser demo suite explicitly tests the pre-existing read-only demo mode in a separate process. Neither substitutes for the hosted real-user walkthrough.

## Deployment after migration

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for GitHub merging, Vercel settings, the read-only hosted RLS check, and the real two-account devnet walkthrough. The earlier migration sections are retained for reference; do not rerun the migration now that it succeeded.
