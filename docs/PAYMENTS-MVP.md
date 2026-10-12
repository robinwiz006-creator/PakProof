# ProofPak stages 6–8 delivery

Continues `d2f39b2` on `proofpak-credentials-payments-mvp`. Stage 6 was committed as `18dd5ba`; stage 7 as `524bdd9`. Stage 8 connects work history, navigation, origin safety and release checks. No hosted SQL, production settings, merge, deployment, funding or blockchain broadcast was performed.

## What is implemented

- Single-worker paid projects: structured milestone editor, fixed budget/scope/deadlines, draft review/publication, private applications, company selection, immutable offered terms, worker acceptance/decline, milestone evidence, revisions/resubmission and immutable approval history.
- Accepted terms cannot be changed. This MVP deliberately has **no amendment editor**; new scope needs a separately agreed project. Declining an offer allows another applicant to be selected. Accepting it tells remaining applicants they were not selected.
- Separate work states (not submitted/submitted/revisions/approved) and payment states (not sent/pending/paid/failed/needs review/cancelled). Work approval alone does not complete a payment or project.
- Explicit payout authorization from the worker's ownership-verified account wallet. Company owner uses a separately verified **company payer** link for the project's organization. A payer link never grants credential issuance.
- Actual legacy Solana transaction: idempotent canonical recipient token-account creation, one standard SPL `TransferChecked`, and an opaque intent/hash Memo. The paying wallet signs; ProofPak never receives a private key. Exact amount arithmetic uses integer base units/BigInt.
- Signed bytes/signature are verified against the server template and registered in Supabase **before broadcast**. Only then does the browser send those bytes. A duplicate preparation returns the active intent; one receipt/signature cannot settle multiple milestones.
- Independent finalized settlement: devnet genesis, allowlisted mint/program/decimals, original registered bytes, payer/signer/authority, canonical accounts, recipient historical ownership, amount, source debit, destination credit, no unexplained token movement, and matching intent memo. Missing historical ownership metadata never becomes Paid.
- Private payment history, Explorer links, check/save recovery, and explicit rebroadcast of **identical already-registered bytes** while valid. No automatic repayment. Failed means a finalized chain failure. Unknown/missing/expired signatures stay pending or needs review.
- A protected daily reconciliation endpoint and Vercel cron configuration supplement immediate browser checks. It reads chain data and saves verified outcomes; it never broadcasts. Daily scheduling is compatible with the basic Vercel cron limits. Up to eight pending attempts are checked per invocation; a larger product needs a queue/more frequent scheduler.
- Both company disclosure consent and worker publication choice are required for completed paid work on a public passport. Approved evidence has another opt-in. Work-history tables contain no amount, wallet, receipt or private accepted-terms fields. Payment does not issue a skill credential.
- Unified Opportunities navigation links skill challenges and paid projects. Existing passports, organization credentials and v1/v2/v3 proofs are retained. Browser testing found and fixed a Host/origin mismatch affecting legitimate wallet/proof/payment API calls behind Next's internal bind address; cross-origin rejection remains tested.

## Company walkthrough

1. Email signup/sign in. Create a company organization at `/organizations` (or register your existing owned company there). Registration is enough to link a payer wallet; trusted credential issuance still requires independent issuer authorization.
2. Open **Paid Projects → Create a paid project**. Add scope, requirements, skills, total budget, deadline and milestones with amounts/deliverables/dates. Amounts must sum exactly to the budget. Dates are UTC dates; project and milestone dates must be current/future at creation.
3. Review the draft and **Publish project**. In this MVP, draft facts are fixed too: recreate an incorrect draft rather than silently editing an agreement.
4. Review private applications and evidence. **Select worker and send fixed terms**. Wait for worker acceptance. If declined, select another applicant.
5. Review each submitted milestone; request revisions or approve with feedback. Approval pins the exact submission and creates no payment/credential automatically.
6. At `/wallet`, prove control of a **company payment signing** wallet for this organization. Owner permission is required. Fund it externally with free devnet SOL and test tokens of the exact mint below.
7. Once the worker authorizes a payout wallet, use **Prepare and review payment**, inspect amount/destination/fee/rent, then **Sign and pay exact amount**. Use that same linked Phantom/Solflare account.
8. Wait for finalization and server verification. See Paid only after a receipt is recorded. Open `/payments` for history/Explorer/recovery.
9. All milestones must be approved and settled before the project becomes completed. Grant company disclosure consent if work/evidence may appear on the worker's passport. An authorized organization can issue a **separate** credential through the existing credentials workspace.

## Individual walkthrough

1. Email signup and build/publish a passport normally; no wallet required.
2. Open **Opportunities → Paid Projects**, read scope/budget/milestones and apply with an explanation/evidence URL.
3. If selected, read the offered fixed terms and accept or decline. Do not assume direct payment is guaranteed.
4. Submit milestone work, read feedback, and resubmit after revisions. Approved and paid remain distinct.
5. Link an **account** wallet at `/wallet` using a one-use ownership message. On the project, explicitly authorize that address for payout.
6. Track each payment in the project or `/payments`. Receiving standard tokens needs no recipient SOL if the payer creates the associated token account.
7. When completed, opt into passport work history, add an optional self-reported summary, and separately choose evidence sharing. Company consent and a published passport are also required. Private terms/receipts/amounts stay out of that record.

## Recovery rules

- Wallet declines/signing fails: no transfer. Retry a fresh preparation or cancel its unregistered preparation.
- Registration fails/response is lost: do **not** broadcast based on a local success toast. Refresh payment history. If registered, its signature/bytes are durable; if not, no app broadcast occurred.
- Browser closes after registration but before sending: original payer can **Resume sending same signed transaction** while its blockhash remains valid. No new signature/obligation is created. Once finalized or expired this action is refused.
- Chain succeeds but saving fails: **Check and save existing transaction**. Unique receipts make retries idempotent. Never send a fresh payment to solve database storage failure.
- Pending/unknown: retain the signature. Wallets/destination remain pinned. Either party may cancel an **unregistered** preparation, but no registered attempt can be cancelled here.
- Finalized failure: no receipt; locks are released and a fresh preparation is allowed. Network fees may still have been spent.
- Signature missing after expiry, wrong transfer, or missing historical metadata: **Needs review**, never Paid/Failed by guess. Reconcile through a reliable archival devnet RPC. No automatic fresh payment or unsafe manual “mark paid” override exists. Support resolution for genuinely irretrievable expired attempts is not automated in this MVP.
- Manual/outside-app transfers do not automatically settle milestones. Unexpected/under/overpaid evidence cannot satisfy the exact registered obligation.

## Manual release configuration — not applied by Codex

1. Retain a tested backup of existing users, profiles, company memberships, challenges, credential/achievement records and signatures. Record the current production deployment/commit.
2. Confirm all preceding migrations through `202610120004_wallet_ownership.sql` are installed. Use the prior Phase 1/credentials release guides for any missing prerequisites; never rerun the initial migration on an existing database.
3. Run the **read-only** `docs/payments-preflight.sql` in Supabase SQL Editor. Before first application it should show **no conflicting objects** and four true prerequisite flags. If anything exists, inspect the successful migration history and apply only missing files.
4. After founder authorization, manually run each full new file **once, in order**:
   - `202610120005_paid_projects.sql`
   - `202610120006_milestone_payments.sql`
   - `202610120007_paid_work_history.sql`
   - `202610120008_payment_workflow_guards.sql`
   Each is transactional. Do not rerun a successful file. Migration 008 adds the acceptance finalizer and safely replaces only the new unsigned-cancellation function; original migrations and historical proofs were not overwritten.
5. Run `docs/payments-validation.sql`. Expect 12 new RLS-protected tables and the two unique live-intent/attempt indexes. `store_payment_template`, `register_signed_payment`, and `record_payment_result` must be **false** for authenticated execution and **true** for the trusted server role.
6. Existing Supabase/site/RPC variables remain required; no auth URL change is needed. `SUPABASE_SERVICE_ROLE_KEY` is server-only. For scheduled reconciliation, add a long random **server-only `CRON_SECRET`** in Vercel settings at authorized release. Do not paste it into chat or prefix it `NEXT_PUBLIC_`. `vercel.json` schedules the job daily; manual checks work without the cron secret.
7. Both public and server RPCs must use devnet. Read-only RPC during this implementation confirmed mint **`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`**, program **`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`**, **six decimals**, initialized, and the devnet genesis. Runtime checks repeat this and disable payments on mismatch. The mint is an externally supplied **test asset**, not a promise of real USDC backing/value/redemption.
8. Founder funds wallets externally using an appropriate devnet SOL faucet and issuer/test-token faucet (e.g. Circle's test faucet if it currently supports this mint). Faucet availability is not guaranteed or tested here. Do not use mainnet USDC or a different mint because its symbol says USDC. A payer needs these exact test tokens in its canonical associated token account and devnet SOL for fees/rent.
9. Review the branch before any separately authorized merge/deployment. This task did not change main or production. If a deployment fails after additive SQL, restore the previous deployment and retain new tables/records/signatures; do not drop tables or reset the database.

## Validation and remaining limitations

Production build, TypeScript, ESLint and Prettier passed. **27 unit tests and 28 desktop/mobile browser checks passed.** Isolated database suites also passed, including preserved historical rows. Unit and database tests cover workflow permissions, fixed terms, consent/privacy, wallet locking, duplicate intents/receipts, signed-template tampering, genuine **offline** signing, finalized/failed/pending/mismatched transfer fixtures and historical-data preservation. Browser checks cover public routes, unavailable/auth states, desktop/mobile widths and origin protection. They do not prove a logged-in hosted Supabase or wallet-extension journey.

No real transaction was broadcast. Founder-led real registration, company/worker walkthrough, payout ownership, actual token receipt, account creation/rent, save recovery and public passport sharing still require testing after authorized setup. No exhaustive concurrency/fault-injection audit or real-money launch audit was performed.

No amendments, refunds, disputes, escrow, guaranteed funds, team splits, commissions or mainnet support were added. Advertised opportunity budgets are visible in listings as required; actual receipt/wallet data remains private to project parties in the app. Solana transfers themselves are public. Private URLs retain the underlying document host's own access rules.
