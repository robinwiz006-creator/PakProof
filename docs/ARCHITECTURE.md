# Architecture and access rules

## Request and data flow

Next.js server components read Supabase using the visitor’s cookie session and publishable key. Server actions validate forms with Zod, authenticate again, and write through row-level security. `src/proxy.ts` refreshes the session cookies using the supported Supabase SSR flow. The public and portal routes share a lightweight responsive component system built with Tailwind/global design tokens and Lucide icons.

Data model:

- Supabase `auth.users` → private-by-default `profiles` (one per user).
- `profiles` → `projects` and `challenge_submissions`.
- `companies` ↔ users through `company_memberships` with owner/reviewer roles.
- `companies` → `challenges` → `challenge_submissions` → immutable `submission_reviews` and one `achievement` on approval.
- `achievements` → at most one `blockchain_proof`.
- `skills` provides the initial skill catalog; profile/challenge skill arrays support free-form MVP tags.

Indexes cover ownership, challenge reviews, and public passport evidence. Timestamps record creation/update and issuance. Challenge company ownership cannot be changed after creation.

## Protected transitions

`create_company` atomically creates a company and the caller’s owner membership. Clients have no membership-write policy. Owner profile editing and member challenge writes are constrained by database policies.

`submit_work` checks that the challenge is published and before its UTC deadline, refuses submissions by the issuing company’s own members, and permits revisions only after an improvement request. One submission per candidate/challenge is enforced by a unique constraint.

`review_submission` locks the submission, checks caller membership of the **challenge’s actual company**, rejects self-review and non-pending records, writes the review and status in one transaction, and issues one achievement on approval. Candidates cannot directly update statuses, insert reviews, or mint achievements. Concurrent/duplicate approvals cannot create duplicate achievements.

Public profiles require explicit publication. Submission evidence and review feedback are visible only to the candidate and the relevant company; public passports show projects and approved achievements. Emails are never part of public profile queries.

## Proof registration and verification

Wallet Standard supplies an authorized devnet account and signs memo transaction bytes. The browser submits the signed bytes to the configured devnet RPC. The reviewer then POSTs only the signature, wallet, and achievement ID to `/api/proofs`.

The route validates same-origin submission, authenticates the reviewer, recomputes the immutable canonical record, fetches a finalized parsed transaction from devnet, and verifies success, the signer, memo program, and exact hash. It uses a server-only service-role client **only after those checks** to insert the proof. All general product writes continue to use the user’s session and RLS.

The public verification page repeats the SHA-256 calculation and live RPC check. Stored evidence is not treated as sufficient during an RPC outage. Canonical serialization is explicitly versioned and excludes personal data. A SQL admin remains a trusted party: service-role/database administrators can change data, and issuer identity/assessment truth is not certified onchain.

## Why not SAS yet?

The current official SAS design registers credentials and authorized signers, then creates schemas and attestations (optionally tokenized). It is a reasonable future migration, but requires issuer/schema provisioning and lifecycle checks beyond a memo anchor. The chosen fallback uses a real Solana transaction, not a simulation. The record version enables introducing a new proof format later without silently reinterpreting old hashes.
