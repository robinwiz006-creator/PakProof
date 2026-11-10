# ProofPak

**One place to show your skills, prove your work, find opportunities, and get paid.**

ProofPak brings a professional Skill Passport, evidence-based assessments, organization-issued credentials, employer discovery and optional paid work together. It is not a freelance-only marketplace. A person can build and share a useful Passport without entering a challenge or connecting a wallet.

## Release status

The implementation includes Tasks 14–16, merged in PR #9 at `00fa9830e3444f35e8ed6a323fc2933a2d0e9970`. This describes source code, **not a verified production deployment**. Hosted account journeys, current production migration state and physical-wallet transactions require acceptance testing. Current payments use **Solana devnet test USDC with no monetary value**.

The prepared [Task 17D permission patch and local rehearsal](docs/TASK-17D-PERMISSION-REHEARSAL.md) adds a twentieth, forward-only migration after the ten pending schema migrations. It remains unapplied to hosted Supabase.

Start with the [Task 17 readiness report](docs/TASK-17-RELEASE-READINESS.md) and [hosted testing guide](docs/PROOFPAK_HOSTED_TESTING_GUIDE.md). Earlier task reports are historical snapshots; their test totals and statements about unapplied migrations do not establish today's hosted state.

## Development continuation

Tasks 19–24 add safe authentication context, pending actions, independent Passport error handling, clearer organization setup, private-by-default education/employment history and verified-email credential invitations. Invitation email delivery is not configured: issuers share private links manually. These features are **not hosted verified** and require the pending schema. Use [the current development handover](docs/PROOFPAK_DEVELOPMENT_HANDOVER.md) for branch, migration order and continuation commands. Historical audits are preserved as dated evidence, not current feature inventories.

## The four pillars

| Pillar                    | What is implemented                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build your Skill Passport | Profile, skills, editable projects, evidence links, achievements, accepted credentials and consented completed paid work in one public URL.                                |
| Prove your work           | Practical challenges, versioned assessment criteria, review and feedback, separate credential issuance, institutional issuer review and historical integrity checks.       |
| Find opportunities        | Published challenges and paid projects, search/filtering, applications, organization-side candidate discovery, private shortlists and consent-based contact.               |
| Get paid                  | One-worker project agreements, milestones, revision/approval, direct devnet test-USDC transfers, independent settlement verification and interrupted-transaction recovery. |

## Candidates

- Register with email/password, confirm email where configured, and use password recovery or resend confirmation.
- Follow optional profile setup: About me → Skills → Work/projects → Preview/publish. Edit projects without duplicating them, remove with confirmation, and manage profile visibility.
- Share `/talent/<slug>`. Projects and skills added by the person are distinct from reviewed achievements and organization-issued credentials.
- Browse opportunities, submit challenge work, apply for paid projects, accept offers and submit milestone evidence.
- Accept or decline credentials; choose credential publication and supporting-evidence/assessment sharing separately. Profile publication alone does not publish every credential or private assessment.
- Opt in separately to employer discoverability and contact requests. Accept/decline requests and close further contact. Personal email/phone is not automatically shared.
- Choose whether eligible completed paid work appears on the Passport. Payment completion does not automatically issue a skill credential.

## Organizations and issuers

Organizations reuse company memberships; supported types include universities, training institutes, communities, hackathon organizers, companies and other professional organizations.

Members can manage permitted opportunities, review evidence, search opted-in public Passports, keep private shortlists and send bounded contact requests. Financial and identity-management actions retain their stricter role checks. Membership is not the same as credential-issuer authorization.

Credential issuance requires explicit administrator-approved **credential categories**. Approval for a training certificate does not permit an academic degree. New credentials record their authenticated issuing representative privately; public verification does not disclose staff account UUIDs.

Institutional trust is a separate administrator-reviewed process:

| Level                      | Meaning                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Self-registered            | Organization account exists; institutional identity has not been independently reviewed through this process. |
| Verified Organization      | ProofPak administrators reviewed institutional identity and representative authority.                         |
| Trusted Assessment Partner | Institutional identity and assessment standards were reviewed.                                                |

Registration, wallet ownership, payments and organization type do not grant trust. Private evidence submissions, decisions, reasons and audit history are protected. Administrators cannot approve organizations they belong to. Suspension/downgrade changes current trust labels without silently revoking historical credentials. Institutional approval is **not government accreditation or a guarantee of every claimed result**. Stopping new issuance requires the separate category-authorization controls.

## Assessments and credentials

Challenges can have optional versioned criteria. Authorized reviewers record outcomes and private feedback; optional structured details include competencies, assessment method, evaluator-reported result/score and date. The challenge's recorded difficulty describes task context, not a global ranking of the person.

Approval creates an achievement. **Issuing a credential is a separate authorized decision.** Approved work can prefill that workflow, linking the submission and immutable assessment snapshot. Direct credentials without a challenge are also supported, but are not automatically given assessment metadata they never recorded.

Accepted public credentials at `/credentials/<id>` show the issuer, current trust, permitted assessment summary/evidence, issue date and separate lifecycle/integrity checks. Anyone can inspect a publicly shared credential without signing in or connecting a wallet.

- Pending/declined records remain private; acceptance and publication are separate.
- Explicit expiry dates are supported; no dates or scores are invented for legacy records.
- Corrections create a new credential linked to the original, with fresh recipient consent. An accepted replacement supersedes its original; private replacement details remain hidden.
- Revocation preserves historical records. A revoked record is not made valid by a matching blockchain transaction.
- Current status can be rechecked. Private correction reasons, internal evidence and staff audit metadata are not public verification data.

Immutable assessment history cannot be silently edited through a certificate correction. Incorrect assessed work needs the appropriate existing review/revocation process, not a manual historical-row update.

## Employer discovery and contact

Organization members search server-paginated, explicitly discoverable public Passports by public name/headline, skills and projects, with public credential/assessed-achievement filters. Hidden evidence must not influence public filters or counts.

Shortlists and internal notes are organization-private. Making a Passport private or disabling discovery/contact removes organization access under the existing gates. Accepted contact requests allow a small, private follow-up exchange, with closure and limits—not full chat, automatic recruitment, or an applicant-tracking system. Linked opportunities are rechecked for ownership and availability; contact acceptance creates no application or agreement automatically.

## Paid work and wallets

Companies publish projects, define exact milestone budgets/deliverables, select one worker and send terms for acceptance. Accepted terms cannot be edited unilaterally. Work submission, approval and verified payment are distinct states. Draft corrections, withdrawal, guarded cancellation, private history and uncertain-payment recovery are implemented.

Payments are **direct transfers after approval, not escrow**. Funds are not locked or guaranteed. Current configuration:

- Network: Solana devnet only, enforced by genesis checks.
- Test-USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.
- Token program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`; six decimals.
- Amounts use integer token units. Server verification checks finalized successful transfer, mint/program, amount, authority, recipient ownership and receipt uniqueness before marking paid.

Phantom and Solflare extension/in-app-browser methods are supported in code. Wallet linking requires an authenticated, nonce-based ownership signature verified on the server. Personal, company payer and credential issuer permissions remain distinct. Unsupported desktop-to-phone QR pairing and a generic wallet marketplace are not offered. Wallets are optional for normal Passport use.

Signed attempts and original signatures are retained for recovery. Unknown outcomes must be checked/reconciled rather than automatically repaid. Never use a manual “mark paid” override. Public work-history consent is separate from private payment amounts; blockchain transfers remain publicly discoverable even when the app hides financial details.

## How Solana is used

ProofPak uses real wallet-signed Memo integrity commitments for achievements (historical v1/v2) and general credentials (v3), plus SPL-token milestone transfers. No custom smart contract, token, NFT or escrow program is deployed.

Only the commitment hash is in the credential/achievement memo; private documents and personal details are not written into that memo. The application retains records, consent, issuer review, assessment context, current lifecycle and transaction references in Supabase. Transaction/account metadata on Solana is still public.

A positive integrity result requires a matching claim and a successful finalized transaction checked by the server. A stored signature is insufficient. A historical proof does **not** establish current credential validity, institutional identity, accreditation or skill competence. Current trust, consent, correction and revocation rely on ProofPak's database. Devnet may reset and RPCs may fail; unavailable checks must remain unavailable, not verified.

See [recovery](docs/SOLANA-RECOVERY-RELEASE.md), [assessment transparency](docs/ASSESSMENT-TRANSPARENCY-DELIVERY.md) and [lifecycle verification](docs/CREDENTIAL-LIFECYCLE-VERIFICATION.md).

## Architecture

Next.js 16 App Router, React 19, TypeScript and Tailwind CSS; Supabase Auth/PostgreSQL/RLS; Solana wallet providers and RPC verification. Server actions and route handlers retain backend authorization; database policies/functions enforce private data boundaries. Privileged service keys stay server-only.

Key locations: `src/app` routes, `src/components` UI, `src/lib` domain/server logic, `supabase/migrations` ordered schema changes, `tests` unit/browser/SQL/REST fixtures. `vercel.json` schedules payment reconciliation; cron authorization and hosted execution must be checked separately.

## Local setup

Requires Node **>=24.19.0 <25**, npm, and Docker for database/REST suites.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell: use `Copy-Item .env.example .env.local`. Open the URL printed by Next.js. With Supabase unset, labeled demonstration routes are read-only; they do not prove account, credential or payment workflows work. No fake live opportunities or blockchain success should replace missing services.

For saving real local-development accounts, use an explicitly designated development database. On a **fresh empty** Supabase database, review and apply all 24 migration files in filename order. On an existing database, inspect history and objects and apply **only verified outstanding migrations**. Never rerun the initial migration, run fixture/bootstrap SQL in hosted Supabase, or assume a CLI push is safe. See the readiness report for order and cutover risks.

### Configuration

Use `.env.example`; never commit `.env.local` or share credentials.

| Variable                               | Purpose                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Intended environment's project URL.                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same project's public API key; RLS remains essential.                                        |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server-only wallet/proof/payment operations; never expose via `NEXT_PUBLIC_`.                |
| `NEXT_PUBLIC_SITE_URL`                 | Exact application origin, matching Auth callbacks.                                           |
| `SOLANA_RPC_URL`                       | Server devnet RPC; private provider credentials stay here.                                   |
| `NEXT_PUBLIC_SOLANA_RPC_URL`           | Browser-safe devnet RPC; no private credential.                                              |
| `CRON_SECRET`                          | Server-only authorization for scheduled reconciliation.                                      |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`         | Optional legacy signing-session recovery; not needed for supported extension/in-app linking. |

Supabase Email Auth must be enabled. Configure Site URL, `/auth/callback` and recovery callback URLs for the actual host. Reliable public email delivery needs appropriate SMTP configuration; code does not bypass confirmation. Never set `PROOFPAK_E2E` in a hosted deployment.

## Automated validation

```bash
npm test
npm run test:db
npm run test:privacy
npm run test:upgrade  # Populated synthetic legacy upgrade; Docker only
npm run test:e2e -- --workers=1
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Install Playwright Chromium if needed with `npx playwright install chromium`. An existing system Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` (shell syntax varies on Windows).

Database/REST commands create disposable local Docker PostgreSQL/PostgREST with synthetic users and remove them on exit. They must never be pointed at hosted data. Browser tests build the configured local Next.js output with blank hosted credentials and explicit offline fixtures; real wallet approval/email/hosted RLS are not established by those tests. Use [the hosted guide](docs/PROOFPAK_HOSTED_TESTING_GUIDE.md) to record actual acceptance evidence.

`npm run doctor` is read-only but uses the currently configured project and checks only part of the schema; it does not prove the full migration ledger or current production policies. Confirm the target first and do not publish its credentials or user data.

## Deployment cautions and limitations

- A GitHub merge or successful local build is not proof Vercel promoted the commit to Production. Confirm the production domain's actual deployment SHA, environment and logs.
- Use the existing Vercel project, Next.js defaults, `npm ci`, `npm run build`, Node 24.x meeting the minimum, and the approved production branch. No build hook applies database migrations.
- Coordinate privacy-view migrations with matching application queries. Reverting to old public grants is not a rollback. Tasks 14/15 require `202611070002_organization_verification.sql` then `202611070003_assessment_transparency.sql` after existing prerequisites. Task 16 has no migration.
- Verify a usable recovery point before schema changes. The Free Supabase plan must not be assumed to have automatic backups. Preserve Auth, public data, schema, grants/functions, migration history and any used storage objects through supported backup procedures; test restoration separately.
- Real hosted two-account journeys, SMTP, physical wallets, RPC recovery, cron execution and finalized devnet settlement still need evidence. No mainnet/real-money launch is claimed. There is no separate bounty/reward-distribution workflow.
- Known dependency advisories remain in transitive wallet/Solana dependencies; see the fresh readiness report and [dependency review](docs/DEPENDENCY-SECURITY-REVIEW.md). Passing tests do not remove those risks or replace independent security review.
- Evidence uses external links, not a secure sensitive-document upload system. No automatic university-database verification exists. General direct credentials do not acquire structured assessments automatically.
- Work history currently combines projects and consented completed paid work; it is not a full structured CV employment-history system. There is no escrow, guaranteed payment, automated refund/dispute resolution, team payment splitting, full chat or automatic skill verification. Employer handoff is intentionally bounded. Issuer review quality requires operational standards and accountable human review.

Before any controlled pilot, resolve deployment/schema uncertainty, review residual security risks and complete the hosted testing record. Do not use real student identity documents, private institutional records or mainnet funds for acceptance testing.
