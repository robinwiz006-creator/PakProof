# Proof and payment interruption recovery

Task 11, based on `8c6cbae` on `fix-wallet-specific-connection`. Local implementation only; no production configuration, hosted database or blockchain state changed.

## Confirmed causes

- Achievement `ProofAnchor` stored the signature only after `sendRawTransaction` returned. A successful broadcast with lost acknowledgement could leave no recovery reference.
- `CredentialAnchor` already saved the signed signature before broadcast, but did not retain the original signed bytes for replay. Both proof flows lacked a persistent in-progress signing reservation and could not safely resume the original transaction after refresh.
- Proof transaction-status checking treated any RPC `err` as failed, even before finalization. That was too weak a basis for discarding an attempt and permitting a replacement.
- Payment preparation cancellation returned only a boolean. The browser had no attempt-specific unsigned-cancellation receipt or explicit unsigned/signing/signed local lifecycle. Old guards could remain after cancellation; deleting all guards would be unsafe because some represent actual signatures.
- Payment signing errors and terminal cleanup did not adequately distinguish a rejected request, interrupted signing, a locally saved signed attempt, or a different stored signature.

## Implementation

### Shared recovery protocol

`src/lib/transaction-recovery.ts` contains tested storage/state helpers. It does not introduce a blockchain claim format, server trust decision or transaction contract.

Proof signing now reserves the existing record key before calling the wallet, then validates the returned signature and exact original message and stores signed bytes plus its derived signature **before broadcast**. If persistence fails, ProofPak does not broadcast. An interrupted or ambiguous signing reservation remains protected. Explicit provider rejection (`4001` or `ACTION_REJECTED`, including wrapped causes) can release an unsigned reservation; generic errors or rejection-looking text are not treated as proof of rejection.

Both proof controls block new signing while a saved, malformed, or storage-unavailable record exists. Recovery prioritizes the original stored signature/wallet/version over editable manual fields. A matching verified save clears only the matching signature's local record. Existing minimal legacy records still support check/save; original bytes cannot be reconstructed from a signature alone.

An explicit **Resume sending original signed transaction** action is available only when original bytes exist. Before sending, the UI rechecks current server claim/authorization, v3 allowed signing wallet, devnet genesis, chain status and blockhash expiry. A seen or expired transaction is checked/saved rather than resent. The replay helper independently validates signature, fee payer, blockhash, single Memo program/instruction and exact existing versioned Memo against the stored claim hash. It cannot turn a tampered local record into an unrelated token transfer. No new signing or automatic replacement transaction is performed.

The achievement prepare endpoint also rejects a new proof when a proof is already recorded or its status cannot be established. POST save/verification remains the existing protected workflow. Failed-attempt discard rechecks server status and applies only to the original effective signature; only **finalized** failures are classified as failed. Not-found, pending, RPC failure or processed/confirmed errors never unlock a replacement automatically.

### Payment cancellation and recovery

After an unsigned preparation is returned, the browser saves a context containing its attempt, intent, milestone, recipient, mint and integer amount. This **unsigned** context does not block signing or a later safe preparation.

Immediately before calling the wallet, the browser changes it to `awaiting_signature` and creates the milestone guard. A confirmed wallet rejection returns it to unsigned state and permits retry/cancellation. A timeout, missing result, changed/invalid response or interrupted signing keeps the guard. Signed bytes remain in the existing payment storage key and must be durably registered through the existing server validator before application broadcast.

Cancellation still uses the existing `cancel_unsigned_payment` database function. No payment lock or SQL permission was weakened. After success the API reads only cancelled attempts with null registered signatures under the caller's RLS and returns an attempt-specific cancellation receipt. A failed receipt read is reported as uncertain rather than authorizing cleanup.

Cleanup requires **all** of: server-confirmed cancelled status, null server signature, matching intent/attempt, local unsigned phase, and no locally saved signed bytes. Other attempts, signed/awaiting-signature phases, malformed data and legacy ambiguous markers remain protected. On refresh, a cancelled attempt's server props can complete the same safe cleanup if the cancellation response was lost. A signed or uncertain attempt is never equated with cancelled merely because the server preparation was cancelled.

Terminal payment cleanup now requires a server-known paid/failed state and a matching signature where one is locally stored. Unknown/pending outcomes and mismatched signatures retain recovery state. Existing original-byte registration/replay, independent settlement checks, pinned payout details, receipt uniqueness and authorization are retained. No manual mark-paid action exists.

### Status language

The controls distinguish awaiting signature, explicit rejection, signed transaction saved, broadcast submitted/confirmation pending, chain finalization awaiting claim/settlement verification, and successful finalization in ProofPak. A Solana signature alone is not a verified achievement or a paid milestone. A proof status lookup checks transaction finality, not skill competence or the claim match; saving/public verification still performs the existing matching checks. Unknown outcomes use recovery guidance and do not offer a newly signed replacement.

## Browser storage and compatibility

Existing keys retained:

- `proofpak:pending:<achievement-id>` — achievement proof recovery.
- `proofpak:credential-pending:<credential-id>` — v3 credential recovery.
- `proofpak:payment:<attempt-id>` — original signature and signed payment bytes.
- `proofpak:milestone-signed:<milestone-id>` — conservative payment guard.

New key:

- `proofpak:payment-context:<attempt-id>` — storage schema 1, IDs/expected payout/mint/amount, and unsigned/awaiting-signature/signed phase.

New proof records also use **browser storage schema 1** with attempt ID, phase, hash, wallet, original claim version, blockhash/height and signed bytes. Browser schema 1 is unrelated to Solana claim version 1. Historical onchain v1/v2/v3 formats and hashes do not change.

Storage must be available for **new** transaction signing. Known manual signatures can still be submitted for server verification if storage is unavailable/corrupt; successful server verification does not permit deletion of unrelated/corrupt local records. Storage failures stop new broadcast rather than pretending recovery is durable.

Never store seed phrases/private keys. Signed transaction bytes are not private keys, but are broadcastable authorizations and may reveal public-chain financial details. Protect shared browsers. Records are deliberately retained across refresh; do not clear site data, private-window storage, or signed markers while an outcome is unknown. New storage is same-origin and browser-specific; it does not automatically transfer across devices/accounts. Other tabs receive storage notifications. Server authentication, organization/payer permissions and strict signature checks remain authoritative; local state never marks a payment paid.

## Security and limitations

- No schema migration, environment-variable change, dependency update, network-setting change, new program, escrow or fee mechanism is introduced.
- Current issuer status, recipient acceptance, credential validity, wallet ownership and company/payer permissions still gate recovery. If a credential is revoked or authority removed before save, recovery may be refused. Do not bypass those checks to save a historical transaction.
- Unknown outcomes remain unknown after blockhash expiry unless strict server chain evidence resolves them. There is no unsafe unlock/operator override.
- A locally signed attempt whose registration failed and whose preparation was cancelled/replaced/expired can still require authorized historical RPC/operator review. Its original bytes/IDs remain available; the UI does not broadcast a closed preparation or sign a replacement. This task fixes **unsigned** cancellation cleanup, not the impossibility of proving every unregistered external transaction absent.
- If a wallet signs but the browser closes before the signed bytes return/persist, the awaiting-signature reservation survives but bytes may be unavailable. Check the wallet/Explorer and recover the original signature manually. A storage/response failure is not permission to sign again.
- Existing records containing only a signature cannot be replayed without original bytes. They still use check/save. Missing/corrupt records are not silently discarded.
- Proof reservations are browser/origin-local, not a new distributed proof-intent system. Concurrent deliberate signing on another device is not globally coordinated before server save; existing unique proof records prevent duplicate application records, not every duplicate network fee. Payment intent/receipt locks remain database-enforced across devices.
- A controlled public proof page still independently checks finalized transaction/hash. Neither a Memo nor a payment proves skill truth or accreditation.

## Recovery walkthrough

1. **Rejected wallet request:** when the provider explicitly reports rejection, no application broadcast occurred. Retry the same unsigned preparation or cancel it.
2. **Signed or signing interrupted:** refresh the same browser and open the original achievement/credential or Payment History. Keep its original signature/attempt/intent IDs. Do not start a replacement.
3. **Proof acknowledgement lost:** check status; if it finalized, retry saving the existing signature. If original bytes exist, status is not found, and the original blockhash remains valid, explicitly resume the original bytes after authorization recheck.
4. **Payment acknowledgement lost:** check/save the registered original attempt. Existing server-authorized resume reuses its exact signed bytes. No new payment obligation is created.
5. **Saving failed after finalization:** retry the same authenticated save/reconcile action. Existing immutable proof/receipt checks handle repeat requests.
6. **Cancelled before signing:** the server receipt clears only a matching unsigned local context. If the UI instead reports a signed/uncertain local attempt, stop and preserve it for review; do not clear storage to defeat the guard.
7. **RPC unavailable, expired unknown history or signing bytes missing:** preserve the reference, inspect reliable archival devnet history through authorized support, and keep locks until evidence resolves it. There is no mark-paid shortcut.

## Files changed

- `src/lib/transaction-recovery.ts`: shared recovery/storage, signed-proof capture/replay validation, finalized status classification and safe payment cleanup.
- `src/components/proof-anchor.tsx`, `credential-anchor.tsx`: proof reservation/persistence, original-byte resume, guarded discard and clear statuses.
- `src/components/milestone-payment.tsx`: unsigned/signing/signed context, safe rejection/cancellation/terminal cleanup and recovery guidance.
- `src/app/payments/page.tsx`: render cancelled unsigned attempts in history so lost cancellation receipts can be safely reconciled on refresh.
- `src/lib/solana.ts`: finalized failure classification.
- `src/app/api/proofs/route.ts`: reject duplicate/unavailable new proof preparation.
- `src/app/api/payments/route.ts`: authorized unsigned cancellation receipt.
- `src/components/transaction-recovery-fixture.tsx`, `src/app/test-ui/page.tsx`: explicitly offline, gated browser test fixture.
- `tests/transaction-recovery.test.ts`, `tests/e2e/transaction-recovery.spec.ts`: interruption, bytes, cleanup, consent/auth guards and refresh regression tests.

## Release prerequisites

Review/deploy matching code only after authorization and the existing schema prerequisites from earlier tasks. This task adds no migration and does not apply earlier migrations. Do not change production RPC settings. Test an isolated preview with real accounts and separately authorized wallet actions; physical-wallet interaction and real hosted/chain recovery are not verified by mocked tests.

Recommended next task: perform the isolated two-account/real-device acceptance walkthrough when the founder is available, then address operational reconciliation fairness and any evidence-backed recovery blockers without weakening settlement verification.

Exact local validation results are recorded after the final checks complete.

## Recorded automated validation

| Check/run | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Final unit suite | 85 | 0 | 0 |
| Disposable database workflow/upgrade suites | 12 | 0 | 0 |
| Direct REST security suite | 43 | 0 | 0 |
| Complete browser run before the last refresh-fixture additions | 164 | 0 | 0 |
| First focused recovery run | 12 | 0 | 0 |
| Expanded focused run | 14 | 2 | 0 |
| Final corrected focused run | 16 | 0 | 0 |

The expanded-run failures were the unsigned lost-cancellation-receipt refresh fixture on desktop and mobile: the built test UI lacked the newly added cancelled-state alias. The alias was corrected and the test strengthened to assert the intended fixture heading. The entire expanded recovery file then passed. The interrupted-signing tests also pass against that correct fixture, rather than merely observing unchanged storage on the default fixture. No assertions were weakened or product authorization bypassed.

Browser runs used one worker. The focused counts overlap the full run: **168 distinct browser cases were covered across runs**, not a single initial 168-case full run and not the sum of every execution. The final focused rerun exercises the last fixture/history-cleanup changes. Earlier failures are retained above rather than reported as an entirely green first attempt.

Final lint, TypeScript, formatting, `git diff --check` and production build passed. No schema or dependency file changed. Seven new unit tests exercise signed-byte persistence/replay, lost acknowledgement, duplicate capture, wallet rejection, storage quota/unknown signing, changed transactions, cancelled unsigned versus signed state, exact obligation metadata, finalized-only failure classification and tampered recovery metadata. Eight new browser scenarios run under desktop/mobile profiles with explicitly mocked APIs. Existing SQL/REST/crypto suites retain historical claims, wallet authorization, strict settlement, immutable receipt and public/private boundaries.

No physical wallet, hosted Supabase account, live deployment, real finalized devnet transaction or successful mainnet transfer was tested. Real device/hosted recovery acceptance remains required before release claims.
