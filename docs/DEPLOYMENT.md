# Deploy the existing MVP

The initial migration has already been applied manually. Do not apply it again.

## Verify hosted policies (read only)

In Supabase, open SQL Editor → New query and run:

```sql
with expected(table_name, expected_policies) as (
  values ('profiles',2), ('companies',2), ('company_memberships',1),
    ('skills',1), ('projects',4), ('challenges',3),
    ('challenge_submissions',1), ('submission_reviews',1),
    ('achievements',1), ('blockchain_proofs',1)
)
select e.table_name,
       c.oid is not null as table_exists,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_catalog.pg_policy p
        where p.polrelid=c.oid) as actual_policies,
       e.expected_policies
from expected e
left join pg_catalog.pg_namespace n on n.nspname='public'
left join pg_catalog.pg_class c
  on c.relnamespace=n.oid and c.relname=e.table_name
order by e.table_name;
```

Expect ten rows, table_exists and rls_enabled true on all, and actual_policies equal to expected_policies (17 total). Inspect Authentication → Users after the first signup and confirm a corresponding profile exists in Table Editor → profiles. The doctor confirms table and workflow RPC exposure, but cannot read PostgreSQL policy/trigger catalogs. The local integration test checks the exact migration's policies and protected transitions, not the hosted definitions.

## GitHub

All implementation changes belong on work and then main. If Codex reports that both branches were pushed, no GitHub merge step remains. Otherwise open https://github.com/robinwiz006-creator/PakProof/compare/main...work → Create pull request → Create pull request → Merge pull request → Confirm merge. Do not force push.

## Vercel

1. Sign in to Vercel with GitHub. Click Add New → Project → import robinwiz006-creator/PakProof. Grant repository access if requested.
2. Use framework Next.js, root directory the repository root, install command npm ci, build command npm run build, and default output directory. In project settings select Node.js 24.x (package.json requires Node 24). Use main as the Production Branch.
3. Add the six variables below in Production. Values saved in Codex are not automatically copied to Vercel. Copy Supabase keys privately from the project dashboard. Do not send them through chat.

| Name | Value / source |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | Your Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Your Supabase publishable key |
| SUPABASE_SERVICE_ROLE_KEY | Your Supabase legacy service_role key; server-only, needed to save verified proofs |
| NEXT_PUBLIC_SITE_URL | The final HTTPS Vercel origin, without a trailing slash |
| SOLANA_RPC_URL | https://api.devnet.solana.com |
| NEXT_PUBLIC_SOLANA_RPC_URL | https://api.devnet.solana.com |

Do not set PROOFPAK_E2E on Vercel. Never add a NEXT_PUBLIC_ prefix to the service-role key. A public RPC URL must not contain a private provider credential.

4. If you do not yet know the final domain, deploy with NEXT_PUBLIC_SITE_URL set to an anticipated project domain, then use the actual assigned domain from Settings → Domains. Correct NEXT_PUBLIC_SITE_URL in Settings → Environment Variables and redeploy before registration. Prefer the stable project domain over a deployment-specific URL. Example domains in documentation are not guaranteed to be assigned to you.
5. Configure Supabase Authentication → URL Configuration: Site URL = the actual HTTPS origin; Redirect URLs includes that origin followed by /auth/callback. The Site URL, Vercel variable, and domain you use for signup must match. Keep the localhost callback only if local development is needed. Use the production domain for the demo; other preview domains require their own matching redirect/configuration.
6. Check Authentication → Sign In / Providers → Email is enabled. Confirmation is currently required. Configure Authentication → Email / SMTP Settings with your mail provider if needed. Supabase's default mail service restricts recipients and sending rates; use authorized team inboxes for a quick demo or configure custom SMTP for public signup. Never assume arbitrary public email delivery is enabled.
7. In Vercel open Deployments → the latest production deployment → Redeploy after final environment changes. Public variables are captured at build time.
8. Visit the assigned production domain. Check landing, How It Works, Explore Challenges, signup/signin. Fresh challenges should be empty, not demo replacements. If visitors see a Vercel login screen, review Settings → Deployment Protection and make the intended production site publicly accessible using the settings allowed by your plan.

## Real two-account demo

1. In one browser profile, open Sign Up → company / Find talent with SkillBoard. Use an inbox you control and a password of at least ten characters. Open the confirmation link in the same browser profile used for signup. Sign in if asked.
2. Company Profile → create Karachi Labs — demonstration company. Explicitly label the description as a hackathon demonstration. Create Challenge → publish an accessible sales dashboard brief with a future deadline, React/TypeScript/Accessibility skills, and repository plus deployed-demo deliverables.
3. In another browser profile or incognito window, sign up as talent using another inbox. Confirm in that same profile. My Profile → set name/headline/skills, choose a unique slug, and enable the public profile option. Add a project with real public evidence you control.
4. Browse Challenges → open the company's challenge → submit project/GitHub URLs and an explanation of at least 30 characters. Check My Submissions shows pending.
5. Company browser → Review Submissions → inspect evidence → approve with feedback of at least ten characters. Confirm the student's passport contains an achievement with onchain proof pending.
6. In the company browser enable Phantom or Solflare, switch to Solana devnet, and fund the wallet with devnet SOL at https://faucet.solana.com. Keep the recovery phrase/private key private. No mainnet funds or server signing key are needed.
7. On the approved submission's review page select your wallet → Connect wallet & anchor → approve the devnet memo transaction in the wallet. Wait for Finalized Solana proof saved.
8. Open the achievement verification page. Expect Onchain record verified and a working Solana Explorer link using cluster=devnet. The memo should contain proofpak:v1:<the displayed hash>. Visit /talent/<your-slug> signed out and verify its achievement.
9. If the transaction was sent but saving failed, keep the signature and wallet address. Use Retry saving existing transaction, or the recovery fields after reloading. Do not send another transaction to recover the same proof.

The hash proves a record commitment, not independent company truthfulness or identity. This deployment has not yet been demonstrated with real accounts, email delivery, wallet signing, and a finalized onchain proof. Keep demonstration labels on the hackathon accounts even though the records and transaction are real.
