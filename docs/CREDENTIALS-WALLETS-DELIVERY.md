# ProofPak credentials and wallet foundation — implementation delivery

This branch builds on Phase 1 commit `2e8d307`, not the older main branch. Nothing was applied to hosted Supabase, merged into main, deployed, or broadcast to Solana. There are no invented institutions, winners, authorized issuers, or public credentials.

## What is implemented

| Stage | Delivered | Limits |
|---|---|---|
| 1: Organizations | Organization registration (university, training, community, hackathon, company, other); reuse an owned company; existing company memberships; pending/authorized/suspended status; restricted admin dashboard; append-only private review audit | Human identity review is outside ProofPak. No logo upload or self-service team invitations. |
| 2: Credentials | Eight credential types; immutable issued facts; unique UUID; public-slug recipient selection; private acceptance/decline; independent publication/evidence preferences; public verification route; accepted records on passport | Existing users only. No email invitation or bearer-link claiming. No email notifications. |
| 3: Qualification review/lifecycle | Private degree verification requests to authorized universities; institutional approval/rejection with feedback; approved request produces a recipient-pending degree credential; immutable revocation events; replacement issuance for corrections | Private external URLs, not file storage. A replacement is issued through the regular form; include the original ID in its description. No formal replacement relationship yet. No access to university databases. |
| 4: General proofs | V3 deterministic organization-credential claim; real Wallet Standard Memo signing on devnet; server checks finalized transaction, signer, memo, hash, and evidence snapshot; immutable receipt; live public verification; recovery of original signature | Offline tests only. No real wallet transaction was broadcast/tested. RPC availability affects live checks. |
| 5: Wallet ownership | Phantom/Solflare Wallet Standard message signing; random nonce and five-minute expiry; server Ed25519 verification; atomic one-time consumption; purpose-specific links; explicit disconnect/replacement; history retained; database lock guard | Payment-specific lock activation awaits the payment workflow. No payment is available from linking a company payer wallet. |
| 6–8 | Not completed in this delivery | Paid projects, applications, agreements, milestone reviews, USDC settlement/recovery, paid work history and final opportunities UX are NOT implemented. |

The code passes local validation, but these new workflows are **not verified in production**. The migrations must be reviewed and manually applied before the new branch is released. This is a coherent credentials/wallet checkpoint, not the full three-pillar MVP yet.

## Updated individual journey

1. Register with email/password using existing authentication; confirm email as configured by Supabase.
2. Complete profile, skills, projects and evidence in the Phase 1 portal. A wallet and challenges remain optional.
3. Preview, publish and share `/talent/[slug]`.
4. An authorized organization uses the published slug to issue a credential. Private profiles cannot be searched by email.
5. Open `/my-credentials`, inspect the record, accept or decline, and separately choose public display and evidence sharing.
6. Accepted public credentials appear on a published passport. A private passport hides them regardless of credential preferences.
7. For an existing degree, choose an authorized university in My Credentials, submit qualification details and a private evidence URL. It remains unverified while pending or rejected. Approval creates a private credential to accept.
8. Open `/credentials/[id]` to inspect issuer authorization, issue/expiry dates, revocation, and current blockchain integrity. Private or unaccepted records are inaccessible to visitors.
9. `/wallet` is optional. An account wallet is not needed to receive an ordinary credential. A recipient does not need to sign a blockchain transaction.

## Updated organization journey

1. Sign in with an ordinary email/password account and open `/organizations` (also linked from the portal).
2. Create an organization or register an existing company you own. Registration grants no trusted issuer status.
3. Provide the administrator with official identity information and evidence of the representative's authority using a secure channel.
4. An independent administrator reviews outside the application and records authorization in `/issuer-admin`. Administrators cannot authorize organizations they belong to.
5. Issue a credential with recipient passport slug, title/type, description, date, optional expiry/program/award/evidence. No blockchain transaction occurs at issuance.
6. Recipient accepts it. Issued credentials show acceptance and visibility status.
7. Link a **credential issuer** wallet through `/wallet` using a signed ownership message. Linking an account/payer wallet does not authorize credential signing.
8. In the issued credential list, connect that wallet and sign a real devnet Memo transaction. Only the versioned hash goes in the memo. The wallet pays the small devnet SOL fee. The server independently checks finalization before recording it.
9. If saving or broadcast acknowledgement fails, keep the signature saved in this browser before broadcast and retry **saving the existing transaction**, not sending another. Unknown/not-found does not mean failed. The UI permits discarding an attempt only after an RPC reports failure.
10. Revoke with a reason if needed. To correct facts, revoke the original and issue a replacement referencing its ID. Historical claim and transaction remain unchanged.
11. Authorized university staff can review private requests and approve/reject with feedback. Approval never automatically publishes the degree.
12. Existing challenge creation/review/v1-v2 anchoring remains in `/portal/company`.

## Paid-project journey

Not implemented. There is no paid-project creation, worker selection, agreed milestone plan, approval/payment action, receipt verification, USDC transfer, or public paid-work history in this checkpoint. Wallet ownership is the first dependency, not a payment guarantee. No funds are locked. Do not demonstrate payments from this branch or advertise them as available.

## Database and manual configuration (do not run automatically)

### Before a future authorized release

1. Retain a tested database backup/export of the existing database, especially users, profiles, memberships, achievements, snapshot/evidence/sharing tables and blockchain signatures. Retain the current production Git commit and environment configuration privately. This change does not remove existing rows.
2. Confirm Phase 1 migration `supabase/migrations/202610120001_passport_foundation.sql` is already installed. If not, follow the existing `docs/PHASE-1-PASSPORT.md` instructions first.
3. Open Supabase SQL Editor, paste **only** `docs/credentials-wallets-preflight.sql`, and run it. The first result must have **no rows**; the prerequisite result must have three `true` values. Any conflicting object requires inspection, not rerunning migrations.
4. Apply these full files manually **once, in order**, in SQL Editor:
   - `202610120002_organizations_credentials.sql`
   - `202610120003_credential_proofs.sql`
   - `202610120004_wallet_ownership.sql`
   Each has its own transaction. If a file errors, its transaction rolls back. Fix the reason before retrying that failed file; do not rerun a successful file. Record which files succeeded. These are application tables, not fabricated credentials.
5. Run `docs/credentials-wallets-validation.sql`. Expect eleven tables with RLS enabled, fourteen functions, and six enabled new triggers. The two settlement/ownership recording functions must be unavailable to `authenticated` but executable by `service_role`. The nonce table deliberately has no client policies.
6. Create a separate administrator account with the normal signup flow. In **Authentication → Users**, copy that account's UUID. Keep it outside all organizations it will approve. A trusted project owner then manually runs the following in SQL Editor, replacing the placeholder:

   ```sql
   insert into public.platform_administrators(user_id)
   select id from auth.users where id = 'YOUR_ADMIN_USER_UUID'::uuid
   on conflict (user_id) do nothing;
   ```

   This is a privileged bootstrap operation. Ordinary users have no write access to the administrator table. Do not grant administrator access to an unknown representative.
7. Administrator signs in at `/issuer-admin`, independently checks identity and representative authority, and records the decision/evidence note. Notes remain private to administrators. The database rejects approval if the organization identity has changed since the administrator loaded the review. An authorization status is a manual decision by ProofPak, not automatic university verification or a government accreditation check.
8. Existing Supabase auth URLs/settings remain unchanged from Phase 1. No new authentication provider or security setting is required. Wallet APIs require the existing **server-only** `SUPABASE_SERVICE_ROLE_KEY`, public Supabase URL/publishable key, and existing devnet public/server RPC configuration. No private signing key is needed. Never use a mainnet RPC.
9. Reviewed organization names, descriptions, and official websites are locked against owner edits to prevent retaining an authorization badge while silently changing identity. Pending organizations can use the existing company-profile editor. A reviewed identity change needs a new controlled administrative review process (not implemented yet); do not bypass the trigger casually.
10. This branch has not been merged or deployed. Vercel connected to main will generally deploy after an approved merge; require actual deployment confirmation. Do not merge until migrations and review are authorized and completed.

### Compatibility and recovery

New migrations leave historical achievement claims/proofs alone. Organization tables reuse memberships via a company foreign key. A new trigger only restricts profile edits for a company explicitly registered as an organization **and already reviewed**; ordinary existing companies are unaffected.

If application deployment fails, keep all new records/migrations and restore the previous deployment first. Do not drop the new tables, revoke evidence by deleting records, reset the database, or rewrite signatures. Previous code ignores the new tables. It will not show new credentials/wallets, but existing passports and challenge proofs remain available. Preserve failed-save transaction signatures. Recover the same finalized transaction once access/configuration works. Do not send a second transaction to solve a database-save problem.

If an issuer is suspended or a credential revoked/expired while a proof awaits saving, the new-proof API refuses it. The original transaction remains onchain; keep its signature for controlled support reconciliation. No automatic privileged override exists.

## Security boundaries

- All new application writes use guarded database functions. Recipients cannot edit issued facts, authorize an issuer, approve a qualification, or save a fake proof.
- Organization members cannot issue for unrelated organizations, approve their own requests, or issue a credential to themselves.
- Only authorized issuers can issue. Administrator approval is independent of self-registration. Issued name and authorization reference are snapshots.
- Credential/evidence/request reads are protected by RLS. Publication requires recipient acceptance, credential opt-in, and a public profile. Evidence has its own additional consent. Private URLs are not fetched by the server; their underlying host permissions remain the document owner's responsibility.
- Nonces are user-, domain-, wallet-, organization-, and purpose-bound; expire after five minutes; are consumed under a row lock. Message verification uses real Ed25519, not a UI flag.
- Active wallet scopes cannot be silently overwritten. Disconnect keeps history; replacement requires a fresh signature. The database rejects disconnect for a locked wallet. Future payment intents must set/clear that lock under protected workflow functions; the payment workflow is not present yet.
- A credential signer must have a matching purpose-specific ownership record. Current authorized membership and accepted/current credential are checked independently from finalized chain matching.
- Service credentials stay in server modules/APIs. No secret values were printed or committed.

## V1, V2 and V3

V1 and V2 canonical serializers, memo format, historical recovery rules and verification remain unchanged. V3 is separate: `organization_credential`, credential/recipient/issuer IDs, issued issuer name, authorization reference, title/type, description, issue/expiry dates, program, award, salted evidence digest and creation timestamp. Fixed field order and ISO timestamp formatting make issuance and verification deterministic.

Onchain data is `proofpak:v3:<SHA-256 hash>` in a Solana Memo plus ordinary public transaction metadata such as wallet addresses. No name, email, document, or description is placed directly in the memo. Private details remain in Supabase. A public verification page can recompute the full claim hash; if evidence is private, it checks the committed digest but cannot inspect the evidence contents.

A matching finalized transaction proves the committed record matches the chain receipt. It does not prove legal issuer identity, skill, qualification truth, or document authenticity. Issuer authorization and current revocation/expiry status are distinct.

## Validation and manual acceptance

Automated tests include existing v1/v2 behavior, v3 protected fields/canonical order/evidence digest/invalid transaction fixtures, genuine **offline** Ed25519 ownership signatures, nonce replay/expiry, RLS privacy, authorized transitions, immutable facts, lock guards, and preserved populated legacy rows. SQL runs in throwaway PostgreSQL containers, never hosted Supabase. Browser checks without Supabase demonstrate honest unavailable/auth states, not logged-in end-to-end success.

Before demo/release, manually test three real accounts (independent admin, institution representative, recipient), authorization denial/approval, direct award issuance, acceptance/public/private/evidence combinations, degree rejection/approval, revocation and replacement, wallet linking/replay/disconnect, and one genuinely finalized devnet v3 proof with saving/recovery. Confirm a private record returns unavailable to an incognito visitor and a published record shows live chain status. Do not use an actual Superteam or university name without a real authorized representative.

Real hosted authentication, issuer authorization, private document sharing and real wallet signing/broadcast remain untested in this development task. No real transaction was broadcast. Payments/offline payment settlement tests are not implemented or run because the payment feature is not present.

## Exact continuation instruction

“Continue branch `proofpak-credentials-payments-mvp` from its pushed credentials/wallet checkpoint. Inspect `docs/CREDENTIALS-WALLETS-DELIVERY.md` and the current code. Implement stages 6–8: single-worker paid projects/applications/immutable accepted terms, milestone submissions/reviews, exact-integer devnet test-USDC signing and independent finalized settlement with pre-broadcast registered attempts/recovery, and opt-in paid work history on passports. Re-confirm the previously specified devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, six decimals, and Token program `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` through read-only RPC before use. Do not apply hosted migrations, merge/deploy, use mainnet, or broadcast transactions without explicit permission.”

## Checks completed in this workspace

- Production build, TypeScript, ESLint, Prettier and diff whitespace checks passed.
- 22 unit tests passed, including the original v1/v2 tests, v3 fixtures and real offline ownership signatures.
- Isolated database suites passed: original challenge workflow/security, credentials/authorization/privacy/reviews, wallet replay/expiry/disconnect/lock guard, and populated historical-data preservation.
- 20 Playwright browser tests passed on desktop/mobile, including 320px and 390px checks, unavailable credential/wallet workspaces and cross-origin API rejection. These do not simulate logged-in production success.
- Not run: real hosted credential workflow, real wallet ownership in a browser extension, real devnet transaction, paid-project/USDC settlement tests (feature not built).

## Changed source and support files

```text
README.md
docs/CREDENTIALS-WALLETS-DELIVERY.md
docs/credentials-wallets-preflight.sql
docs/credentials-wallets-validation.sql
scripts/test-database.sh
src/app/api/credential-proofs/route.ts
src/app/api/wallets/route.ts
src/app/credentials/[id]/page.tsx
src/app/globals.css
src/app/issuer-admin/page.tsx
src/app/my-credentials/page.tsx
src/app/organizations/page.tsx
src/app/wallet/page.tsx
src/components/credential-anchor.tsx
src/components/credential-record.tsx
src/components/passport-credentials.tsx
src/components/passport-view.tsx
src/components/portal-nav.tsx
src/components/wallet-manager.tsx
src/lib/credential-actions.ts
src/lib/credential-data.ts
src/lib/credential-proof.ts
src/lib/credential-solana.ts
src/lib/credentials.ts
src/lib/wallet-ownership.ts
supabase/migrations/202610120002_organizations_credentials.sql
supabase/migrations/202610120003_credential_proofs.sql
supabase/migrations/202610120004_wallet_ownership.sql
tests/credential-proof.test.ts
tests/credentials-database.sql
tests/credentials.test.ts
tests/e2e/credentials.spec.ts
tests/wallet-database.sql
tests/wallet-ownership.test.ts
```
