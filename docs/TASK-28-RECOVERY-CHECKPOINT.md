# Task 28 recovery checkpoint (2026-11-10)

## Purpose
This checkpoint preserves the *status and next steps* for Task 28 after the Codex execution environment became unavailable. It does **not** recover or claim to include the uncommitted Task 28 working files. The branch is based on the last pushed Task 27 commit `e25171f`.

## Verified GitHub state
- Repository: `robinwiz006-creator/PakProof`
- Last code checkpoint: `task-27-solana-escrow-marketplace` at `e25171f43b08f57622ec940a5bf9ed231f654acc`
- Task 27 draft PR: https://github.com/robinwiz006-creator/PakProof/pull/16 (targeting Task 26)
- Earlier stacked draft PRs: #10 through #15; no development PR was merged in this recovery operation.
- Task 28 branch `task-28-escrow-devnet-integration` was reported as **local only** and was not found on GitHub at recovery time.

## Task 28 work reported locally, NOT recovered
The user supplied the following factual account, which cannot be independently verified from GitHub:
1. Locally created `task-28-escrow-devnet-integration` from Task 27.
2. Downloaded official Agave tooling; first SBF build failed because Cargo 1.84 could not parse a Rust 2024 dependency manifest.
3. Downloaded newer platform tools, but no successful SBF build or executable program tests were confirmed.
4. Drafted finalized RPC collection, strict receipt verification, project-agreement integration helpers and `202611100005_project_escrow.sql`.
5. These drafts remained unvalidated and uncommitted; no push or PR was completed.
6. No escrow UI, complete milestone flow, deployed program, devnet deposit or devnet release were completed.

**Do not assume the draft code or migration exists in GitHub.** If the original local workspace is still accessible, recover the exact files before reconstructing them. Check for ignored/untracked files, temporary workspace and local Git status. Do not copy secrets into the repository.

## Next developer steps (in order)
1. Restore original local execution environment if possible; inspect `git status`, relevant local files and `git log`. Preserve any Task 28 drafts, then review/diff them against the pushed Task 27 baseline. Never blindly overwrite the pushed branch.
2. Use compatible Solana/Agave SBF platform tools and Cargo/Rust for dependencies that require the Rust 2024 manifest; pin and document tool versions. Validate a successful `cargo build-sbf` (or supported equivalent) and local SBF program tests. Native-only custody tests are insufficient.
3. Examine escrow authority/signing, PDA/account ownership, vault mint/amount, agreement binding, release/refund/dispute constraints, replay/double settlement, and upgrade authority. Do not weaken controls to pass tests.
4. Implement and validate application-side RPC receipt collection, strict instruction/account/amount verification, transaction finality and idempotent reconciliation against genuine on-chain state. Do not trust UI or a transaction signature alone.
5. Review and validate the proposed `202611100005_project_escrow.sql` migration in an isolated DB, including RLS and relationship to existing project/milestone/payment flows. **Do not apply to production.**
6. Connect wallet authorization and full/incremental funding, milestone work/review, authorized token release, receipts, dispute/refund handling and worker payment history without replacing existing direct-payment paths prematurely.
7. Only after successful compiled-program tests and suitable deployment wallet setup, conduct devnet test-token deployment/deposit/release; record program ID, exact transaction signatures, network, test-token mint, deployment checksums and verified observations. No real funds.
8. Keep bounty escrow pools as a distinct next-phase task unless safely implemented and separately tested.
9. Do not claim escrow is launched or mainnet-safe. Independent security review and coordinated database/application deployment are required before production.

## Production release blockers
- Production Supabase is behind the stacked development migrations, which include organization-team authorization changes; app and DB must be released together.
- Backup and restore testing, migration ordering/rehearsal, permission/RLS tests and hosted environment verification remain outstanding.
- Newly developed escrow software has no confirmed SBF build, devnet execution or external security review as of this checkpoint.
- No merge to `main`, Vercel deployment, production migration, mainnet use or real-fund transaction is authorized by this checkpoint.

## GitHub preservation and future work
The latest complete saved code is in `task-27-solana-escrow-marketplace` / PR #16. This checkpoint branch adds documentation only. When work resumes, start from the latest safe development branch and preserve this report. Stacked draft PRs #10–#16 intentionally remain unmerged; they do not need to be merged into main to retain their contents in GitHub.
