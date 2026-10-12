# Phase 1: passport foundation — implementation and release guide

## Scope and release status

Built from main commit `66097de` on `phase-1-passport-foundation`. One ProofPak brand, one login, same Next.js/Supabase/Solana devnet architecture. No institution issuers, tokens, NFTs, AI matching, payments, or fake verification were added. No production migration, environment change, wallet transaction, or deployment was performed.

**Do not merge/deploy this branch until the additive migration has been reviewed and applied manually.** The new pages query its tables/columns. The original application remains usable with the additive schema, but approvals and proof issuance should be paused during the short migration/deployment window to avoid old clients issuing new v1 proofs.

## What changed

- Individual overview has a six-step completion checklist and clear public/private status; the next action follows remaining steps rather than directing everyone toward challenges.
- Profile and project skills offer suggested selections and custom comma-separated entries. Optional profile details can be completed later.
- Private preview and owner passport contain projects, evidence, and achievements using the same view as public passports. Copy-link action appears for published passports.
- Projects support create/edit/remove, title/description/skills/three evidence URLs, preserved validation input, owner-filtered update, and confirmation before removal. Editing changes the existing row instead of inserting a duplicate.
- Public passports put self-reported projects and skills before company achievements and suppress large unused sections. Profile picture uses initials; uploads are not added.
- Recipient-owned achievement sharing links an existing portfolio project and optionally publishes frozen approved evidence. No work is copied into another project automatically.
- Approval creates frozen claim and evidence snapshots. Challenge brief/deliverables, approved URLs, explanation, and issuer label are preserved. Recipients can change sharing choices, never approved facts.
- Public viewers see approved evidence only when the recipient enables it AND publishes the passport. Company members/recipient can read the appropriate private approved evidence. Unrelated private portfolio projects are no longer readable by reviewers.
- Talent navigation includes My Passport, My Projects, My Achievements, Explore Challenges, Account Settings, profile editor, overview, and submission tracking. Existing routes remain valid.
- Header distinguishes signed-in dashboard/passport access from signup/login. Sign-in preserves an allowed challenge destination; signed-out challenge visitors must sign in before seeing the submission form.
- Password reset and confirmation resend use Supabase's existing email security settings. No confirmation requirement is disabled. Error messages do not disclose whether an account exists.
- Company dashboard retains its existing structure. Pending review requires an explicit decision; after approval it explains that the passport achievement exists and provides the next proof action.
- New proof preparation uses v2. Proof display is “recorded, open to verify” until a live finalized transaction and matching claim confirm verification. Pending, failed, mismatched, missing, and unavailable states are distinct.
- Wallet recovery reads browser-persisted signatures on reload and blocks another anchor while one is pending. Status lookup can identify a confirmed failed attempt, which may be discarded safely. Successful-but-unsaved transactions are retried without a new broadcast.
- Homepage/How It Works use ProofPak consistently and explain the portfolio-first journey; challenges are optional and institution credentials remain future-only.

## Complete student journey

1. Homepage → Build Your Skill Passport → choose the talent intention at `/sign-up`.
2. Enter name, email and a password of at least ten characters. Confirm email in the same browser profile; sign in if needed.
3. `/portal/talent` shows progress and the next incomplete step. No achievement or challenge is required to publish.
4. Edit Profile → name/headline/slug; optional introduction, location, institution and skills. Suggested skills are self-reported, not certified.
5. My Projects → add title/description, select skills, and add at least one repository/demo/evidence URL. Edit the same row later; removal requires confirmation.
6. Preview your passport using the checklist action. It marks the preview step and opens the owner-only route `/portal/talent/preview`; this does not publish anything. Project preview links also open this route.
7. Edit Profile → enable Publish my profile, projects and achievements → Save. Optional details need not be completed.
8. My Passport/overview → Copy passport link → share `/talent/<slug>`. Public route works signed out. Turning publication off hides the database-backed public passport again; it cannot erase an onchain transaction.
9. Optional: Explore Challenges → submit URLs and an explanation. Your portfolio project and challenge submission are distinct records; no forced duplication is created.
10. My Submissions → read feedback, revise while the challenge remains open, or see approval. Approval links to My Achievements.
11. My Achievements → select an existing related project if desired; choose whether to publish the approved submission links/explanation. Profile must also be public. Save choices.
12. A company member can separately anchor the claim. Achievement card opens verification; only actual live confirmation says Onchain verified. The student does not need a wallet.

## Complete company journey

1. Register with company intention using the same account system; confirm email and sign in.
2. Create company profile. Creator becomes owner; company identity is self-registered, not legally certified.
3. Publish practical challenge with required fields and future deadline; current create/close flow is preserved.
4. Review received explanation and real external evidence URLs. Choose a decision explicitly and give useful feedback.
5. Request improvements or approve. Existing review authorization still prevents other-company review and self-approval.
6. Approval creates the achievement and immutable snapshot in the same database transaction. Recipient's passport receives it immediately; their evidence remains private until they consent.
7. On approved review, choose Phantom/Solflare and Connect wallet & anchor. Reviewer pays the devnet transaction fee from free devnet SOL. Private keys never enter the app.
8. Preparation gets the v2 claim; wallet signs a real devnet Memo transaction; browser waits finalized; server independently checks it and saves the proof.
9. Open verification/Explorer. If saving fails, retry the existing signature. If chain reports a failed transaction, check status before discarding and retrying; do not rebroadcast blindly.
10. Team invitations, legal issuer verification, contact/recruiting, and direct credential issuance remain outside this phase.

## Database migration: manual and additive

New file: `supabase/migrations/202610120001_passport_foundation.sql`.

It adds:

- `profiles.passport_previewed_at` (nullable).
- `projects.skills` (defaults to an empty array).
- `blockchain_proofs.claim_version` (existing rows default to 1).
- `achievement_claims`: frozen issuer label, type, evidence digest, legacy-recovery eligibility.
- `achievement_evidence`: immutable approved brief/deliverables, URLs/explanation and random digest salt.
- `achievement_sharing`: recipient-owned consent and optional existing-project association.
- RLS policies, ownership validation, immutable-fact triggers, approval snapshot trigger, and private-portfolio access tightening.

**It never rewrites existing achievement fields, submissions, proof signatures or proof hashes, and never publishes evidence automatically.** It inserts new snapshot rows for existing approved achievements; those snapshots describe the current database at migration time, not retroactively authenticated historical v1 evidence. New approvals are snapshotted at approval. Removing a linked project clears its optional association, not the achievement/evidence.

The immutable triggers also block direct administrator UPDATE/DELETE of approved achievements/snapshots and UPDATE of approved submissions. Future corrections/account deletion need a deliberate archival/revocation design; do not disable triggers casually. Existing ordinary application actions do not edit/delete those approved facts.

### Exact actions in Supabase and GitHub

1. Review the feature branch changes and arrange a brief pause in approvals/anchoring while upgrading. Finish or retain signatures for any in-flight transactions; no forced conversion is performed.
2. In Supabase open SQL Editor → New query. Run `docs/check-phase-1.sql` (read-only). New relations should be absent, no new-column rows, and integrity-review count zero. If any new objects already exist or integrity checks fail, stop and inspect; do not reapply or delete records.
3. Retain a backup/export using the project's supported backup tools and record existing achievement/proof counts. This release does not reset data.
4. Open another New query. Paste the entire NEW migration from `begin;` to `commit;`. Run once. **Do not run the initial migration again.** If it errors, keep the error; the transaction should roll back, not leave a partially changed schema. Don't bypass checks.
5. Run the commented post-migration SELECT checks from `check-phase-1.sql` after removing their comment prefixes: all three tables must have RLS enabled; policy counts 1/1/3; missing snapshot count zero. Compare old achievement/proof counts. `npm run doctor` now checks the new tables/columns as well, without writes.
6. Supabase Authentication → URL Configuration: retain the current production Site URL and existing `/auth/callback` redirect. Add the exact recovery callback `https://pak-proof.vercel.app/auth/callback?purpose=recovery`. If the final domain differs, use that domain consistently. Keep local callback only if you use local development. No security setting should be disabled.
7. Check Email/SMTP delivery and that confirmation/recovery templates use Supabase's supported confirmation URL. Resend/reset pages cannot overcome default-provider recipient or rate restrictions. Test with inboxes you control in the same browser profile.
8. After migration review/application, open the branch pull request (or comparison link), review, and merge to main. No automated merge is performed by this task.
9. Vercel should automatically build/deploy main because it is connected to main. Confirm Deployments → new deployment → Ready and the correct commit. No additional secret/environment variable is required. No production variables were changed by this task.
10. If deployment fails after additive migration, retain the old application deployment while diagnosing. Do not drop new tables or alter old proof hashes to “roll back”.

## Solana v1 and v2

### V1 compatibility

V1's fixed-order JSON remains exactly `version`, `achievement_id`, `challenge_id`, `company_id`, `issued_at` with ISO UTC millisecond time. SHA-256 and `proofpak:v1:<hash>` memo rules are unchanged. Historical proof rows get explicit `claim_version=1`; verification chooses those original rules. Legacy pre-upgrade achievements are marked eligible for recovery of v1 transactions with chain block time at or before the snapshot migration boundary (chain timestamps have second precision). Finish in-flight v1 transactions before applying the migration. A newly broadcast v1 transaction after this boundary is rejected by the new API. New post-upgrade achievements cannot use the new API to downgrade to v1. Existing transactions are not resent or converted.

### V2 claim

Fixed-order JSON fields:

```text
version: 2
achievement_id
recipient_id
issuer_id
issuer_name (frozen company label)
title
type: company_challenge
challenge_id
submission_id
evidence_digest
issued_at (ISO UTC milliseconds)
```

Both preparation and verification use the same `claimV2`/`serializeRecord`/`hashRecord` functions. Changing recipient/title/source/issuer/date/evidence digest changes the v2 hash. The Memo is `proofpak:v2:<hash>`. Only that digest appears in the memo; no personal details or document URLs are onchain.

Evidence digest encoding is explicitly PostgreSQL UTF-8 JSONB array text:

```text
[digest_salt, challenge_title, challenge_description, deliverables,
 project_url, github_url, explanation]
```

`encode(sha256(convert_to(jsonb_build_array(... )::text,'UTF8')),'hex')` is computed once for a frozen snapshot. The random UUID salt stays with the private evidence; it helps prevent guessing undisclosed evidence strings from their public digest. When evidence is shared, its snapshot is readable under consent policies. General independent export tooling is not added. Public canonical claim contains the evidence digest, never private raw evidence; approved snapshot updates are blocked. Preparation recomputes the evidence digest; verification recomputes it when that evidence is readable to the viewer. Hidden evidence stays hidden, so anonymous viewers without evidence consent check the canonical claim commitment rather than the private document content. A shared Unicode/escaping golden vector is checked in both SQL and JavaScript.

V2 is not a university credential or proof of legal company identity. Issuer-authority registration, revocation, credential types and durable production-chain decisions belong to Phase 2. Devnet history may reset.

## Validation and remaining limits

Passed locally: production build, TypeScript, lint, formatting, 16 unit tests, database security/workflow tests, and 14 desktop/mobile browser cases. The populated-v1 upgrade test compares all original rows (excluding only additive columns), verifies proof version 1 and unchanged proof fields, and confirms no automatic evidence publishing. SQL tests cover edits without duplicate rows, cross-owner denial, foreign-project association denial, consent/public-private evidence, immutable approved facts/snapshots, correct digests, and removing a project without deleting approved work.

Browser tests exercise labeled read-only demo UI, not authenticated hosted data writes. They cover the new checklist, private-preview layout, achievements empty state, recovery routes, old routes, and 320px/390px widths. Database tests validate real local SQL operations, but not Supabase mail delivery. Unit signing tests are offline; **no actual devnet transaction was sent in this task**.

Manual production acceptance still required after migration/deployment: signup/confirmation/session; project create/edit/remove and privacy; private preview/publish/copy; challenge submission/approval; evidence opt-in/out signed out; v1 historical verification; real Phantom/Solflare v2 finalized broadcast/save/verification; recovery after network/save failure; email reset/resend; real-device wallet behavior.

Remaining limitations: all projects share profile-level visibility; suggested skills are self-reported; linked external content can change; slug changes have no redirects; general uploads/institution issuers/team invites/contact/revocation aren't implemented; revisions still depend on open challenge/deadline. No claim of live production update or end-to-end validation is made.

## Phase 2 decisions

Add a general authorized issuer model and organization staff workflow within the same ProofPak account system. Define credential types, subject consent, expiration/revocation/correction, evidence storage and privacy, and trusted wallet/issuer binding. Extend claim types through an explicit new version/migration; do not reinterpret historical v1/v2 claims. Existing project/passport/sharing components can remain the common presentation foundation.

## Changed source files

See [complete changed-file inventory](PHASE-1-CHANGED-FILES.md). GitHub review should compare only this feature branch to main. Branch: `phase-1-passport-foundation`; comparison: https://github.com/robinwiz006-creator/PakProof/compare/main...phase-1-passport-foundation . If API access blocks PR creation, create the PR there manually. Do not merge until the migration steps above are complete.
