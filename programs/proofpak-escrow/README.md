# ProofPak escrow — development-only native program foundation

**Not deployed. Not audited. No program ID is configured. No live escrow product is enabled.** Existing ProofPak UI payments remain direct Solana devnet transfers. This source must not be advertised as deployed or production-safe.

## Implemented

A focused native Solana program, with classic SPL Token CPI custody. No third-party escrow source was copied. A reviewed compatible third-party integration could not be established through the available documentation/network access. Anchor was not required for this focused processor; explicit ownership, address, token-account and signer checks are exercised by native-bank tests.

- Agreement state PDA: `['escrow', payer_pubkey, agreement_id_32]`.
- Token vault PDA: `['vault', state_pubkey]`; owned by classic Token Program, token authority = escrow state PDA.
- Fixed devnet test mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, six decimals. The program cannot identify a cluster; the application must independently enforce devnet genesis. No mainnet deployment scripts exist.
- Immutable payer/worker, optional independent resolver, agreement ID, terms hash, funding mode and 1–20 exact u64 amounts. Terms must define scope, review/revision/cancellation/dispute rules before either party signs; only their commitment is stored, not private documents.
- Payer signs creation; worker separately signs acceptance. Funding is rejected before acceptance. The database's owner/worker/wallet association still needs to be bound by the future application integration; a program wallet signature is not proof of a Supabase role.
- Full funding transfers the complete allocation once. Incremental funding transfers exactly the next milestone after previous allocations settle. Work cannot start on an unfunded milestone.
- Worker signs start/submission (only an evidence digest on chain). Payer signs approval/revisions and release. A database flag cannot authorize release.
- Dispute by either party locks normal release for that milestone. Resolver, if agreed at creation, may distribute only that milestone's allocation to original parties. Both original parties may also jointly resolve, including when no resolver exists. No third-party destination or unrestricted admin withdrawal exists.
- Refund requires both original parties signing; paid allocations cannot be refunded. Closing before any funding is allowed to either party; sealing a settled agreement requires both. No automatic deadline penalties, unilateral post-work refunds or reversal of released tokens.
- Account identity, mint/program, authority, signatures, replay/state transitions and checked accounting are enforced in program code. Unexpected donations do not allocate milestones.

## Account ordering / wire format

Borsh instruction discriminants: Create=0, Accept=1, Fund=2, Start=3, Submit=4, Review=5, Release=6, Dispute=7, Refund=8, Resolve=9, Close=10. SDK bindings: `src/lib/escrow-protocol.ts`.

Every instruction begins `[authority signer, writable escrow_state]`.

- Create adds `[writable vault, mint, System Program, Token Program]`.
- Fund adds `[writable vault, writable payer source token account, mint, Token Program]`.
- Release adds `[writable vault, writable worker token account, writable payer token account, mint, Token Program]`.
- Refund adds the worker signer before the release accounts; payer is authority.
- Resolve uses resolver as authority, or payer + worker signer before release accounts for mutual resolution.
- Close after any allocation adds the other original party's signer.

State uses `PPESCR01`, 2048 bytes, Borsh fields declared in `Escrow`. Token destinations must belong to the original payer/worker; the program does not require a particular ATA, though a future UI should derive standard ATAs. No fee or commission exists.

## Local test commands

With Docker and Bash:

```bash
bash scripts/test-escrow-program.sh
```

With Rust installed:

```bash
cd programs/proofpak-escrow
cargo test --locked --test custody -- --test-threads=1
cargo fmt --all -- --check
```

Docker uses a pinned Rust image, public crates and a persistent Cargo cache. On a proxy environment the script mounts the existing trusted CA bundle; it does not disable TLS checks. No application credentials/private keys are passed. Build output and deploy keypair filenames are Git-ignored. The supplied tests generate ephemeral synthetic signing keys in memory and seed synthetic token accounts inside Solana ProgramTest. This is actual native Bank/SPL CPI execution, **not an SBF validator or devnet transaction**.

Ten grouped tests cover real custody and releases, full/incremental funding, party signatures, account substitution, mint/program rejection, insufficient balance/atomic rollback, dispute locks, constrained splits, cooperative resolution, refund replay, unsigned authority rejection, revision/approval and overflow/immutable identity. They do not establish SBF compute/stack limits, deployed upgrade governance or production security.

## Explicit unfinished work / release blocker

Official Solana installer access (`release.anza.xyz`) returned proxy CONNECT 403 even after an escalated retry. Rust dependencies and native tests were obtainable through Docker/crates with the trusted CA. No Solana CLI/local validator/SBF toolchain was installed, no SBF executable was built, and no owner-controlled deployment/wallet was available. There is no authorized deployed program ID or independently verified code hash.

Before any escrow UI is enabled:

1. Review/audit protocol economics, cancellation/deadline rules, state machine and upgrade strategy. Add further account-substitution/fuzz/SBF tests and dependencies/advisory review.
2. Build the SBF artifact with the supported Solana toolchain. Test the actual binary on a local validator. Native tests alone are insufficient.
3. Separately approve an owner-controlled **devnet** deployment and record its genuine ID/code commitment/governance. The observation helper rejects upgradeable funded deployments; immutable deployment decisions must follow review, not precede it merely to enable a demo.
4. Extend existing accepted paid-project terms through an explicit jointly accepted escrow agreement/version; never silently change existing direct-payment terms. Bind verified owner payer and worker wallet ownership to program state. Persist signed attempts before broadcast and reconcile original signatures.
5. Implement genuine RPC account/transaction collection, unique receipts, database/RLS settlement, funding-gated milestone submission, UI signing/recovery and Passport integration. `escrow-observation.ts` currently validates supplied read-only observations; it does not fetch RPC or credit any database record.
6. Complete one real devnet end-to-end milestone before implementing prefunded multi-winner bounty pools. Bounties, in-app escrow disputes/evidence, database refunds, project escrow dashboards and new escrow Passport records are **not implemented** in this checkpoint.

Additional unresolved risks: unsolicited tokens and account rent have no withdrawal/cleanup instruction; a missing resolver may require joint cooperation indefinitely; mint freeze authority and wallet compromise remain external risks. No guarantees of dispute outcome or real-money readiness are made. No production settings/schema, hosted data, mainnet funds or blockchain network transactions were changed.
