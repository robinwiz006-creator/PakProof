# Credential detail and verification UX

## Scope

Separate follow-up to wallet simplification `6ccef15`, on `fix-wallet-specific-connection`. The wallet, homepage, dashboard, issuance, acceptance, revocation, v1/v2 achievement proofs, v3 claim format and payment/wallet signing code are preserved. No migrations, hosted database writes, secret changes, push, merge or deployment.

## Implemented

- `/credentials/[id]` presents the actual title, recipient profile name when readable, frozen issuer name, issue date, description, optional programme/award and expiry in a certificate-style layout.
- Warm ivory paper, orange accent, compact trust ledger, responsive typography and a real route-loading state. No fabricated signatures, seals, endorsements or logos.
- Four separate checks: validity (including future/expired/revoked), recipient decision, current ProofPak organization approval and approval reference at issuance, and independently checked Solana integrity.
- Current organization status is not substituted for issuance-time approval. Issuance requires approval in the existing SQL function; the immutable credential retains its authorization reference. Private administrator review notes are not queried or published. Approval is explicitly not independent proof of legal identity.
- The displayed name comes from the current readable recipient profile. The v3 claim binds the recipient account identifier, not that changeable display name.
- Credential IDs, authorization reference, hashes, claim version, signer, anchoring date and transaction signature are under Technical details. A recorded transaction's Explorer link remains easy to find next to its actual integrity result.
- Copy Credential Link uses the current site's real `/credentials/<id>` URL and provides a selectable fallback when clipboard access is denied. It appears only for accepted credentials explicitly published by a recipient with a public passport.
- A recipient can jump directly to their existing acceptance/publication form. An issuing member can open the existing issued-credential management workspace. These are navigation improvements, not new permission grants.
- Evidence is still selected through ordinary user/anonymous Supabase RLS. An additional presentation guard refuses non-shared evidence for unrelated viewers even if accidentally supplied. Evidence salts are never rendered.
- Existing public organization profiles and supplied-logo fields do not exist in the current organization model. The page uses only the actual supplied HTTP(S) organization website; it invents no public issuer route or logo.
- PDF export was not added; there is no new PDF/download endpoint. Live credential status and visibility remain available at the existing protected/public URL.

## Verification boundaries

`credential-verification.ts` extracts the existing page's live check into a testable function. It recomputes the unchanged v3 canonical hash, checks a visible evidence snapshot when available, compares the stored hash and independently calls the existing devnet transaction verifier. Only matching data plus a valid finalized transaction produces Onchain verified. Failed, pending, unavailable, missing and mismatched results remain separate. A malformed snapshot fails closed as unavailable rather than crashing the presentation.

Private evidence can remain hidden while its committed digest is checked. This does not verify the private evidence's contents or the issuer's truthfulness. Revocation, expiry, acceptance and organization suspension are independent of a matching historical transaction.

## Changed paths

- `src/app/credentials/[id]/page.tsx`, `loading.tsx`
- `src/components/credential-detail.tsx`, `credential-share.tsx`
- `src/lib/credential-presentation.ts`, `credential-verification.ts`
- `src/app/globals.css`
- `src/app/my-credentials/page.tsx` (anchor for the existing management form)
- `src/app/test-ui/page.tsx`, `src/components/credential-detail-fixture.tsx` (existing test gate only)
- `tests/credential-presentation.test.ts`, `tests/e2e/credential-detail.spec.ts`, `tests/credentials-database.sql` (independent anonymous privacy regressions)

## Test scope and manual acceptance

Unit fixtures check publication requirements, non-shared evidence, supported URL schemes, deterministic date display, no verification from a stored signature alone, finalized/pending/failed/mismatched/unavailable results and evidence digest tampering. Existing tests cover canonical v3 fields and historical v1/v2 integrity.

Browser fixtures exercise accepted/pending/declined decisions, expiry/revocation, suspended organization with retained issuance reference, independent integrity states, collapsed metadata, copy/fallback, anonymous denial and 320/390/1280 layouts. Controls are explicitly labeled offline fixtures on the gated `/test-ui?fixture=credential` page, unavailable with configured Supabase. No fixture is substituted for a production credential.

The disposable PostgreSQL suite checks anonymous public access after consent, pending/private evidence denial, recipient-only decisions, immutable facts, revocation and forbidden proof writes. This proves local schema behavior, not hosted configuration.

Before release, use authorized demo accounts to:

1. Issue a real credential to a published passport. Open its private detail as recipient and issuer; open the same URL signed out and confirm denial while pending/private.
2. Accept and publish, then inspect in Incognito. Confirm actual name, issuer, description and dates; copy the URL and reopen it signed out.
3. Toggle evidence sharing off/on and confirm the public URL never reveals non-shared evidence. Make the passport private and confirm public credential access disappears.
4. Decline and confirm public access disappears. With a separate test credential, revoke it and confirm the warning remains prominent even if its historical proof matches.
5. Inspect a real already-anchored v3 record; verify a matching finalized transaction is independently checked and linked to devnet Explorer. No real transactions were sent by this task. New real-wallet transactions require separate authorization.
6. Test on actual mobile devices and inspect Technical details using keyboard navigation.

Hosted authentication, real recipient decisions/publication, real Incognito access to accepted credentials and real devnet verification must be tested separately. Screenshots show offline presentation fixtures only.

## Final validation results

- Production build: passed on the final application source.
- Lint, TypeScript, formatting: passed.
- Unit tests: 57 passed, zero failures.
- Disposable PostgreSQL security/workflow/legacy preservation suite: passed, including the added independent private-passport, declined-credential and unpublished-credential anonymous denial checks.
- Full browser run: 95 of 96 passed; one existing mobile smoke test visiting 16 demo routes exceeded its 60-second cumulative limit. It passed in isolation with the same limit (43.8 seconds test time). All 96 cases therefore passed across the full run and targeted retry; the full run was not a clean one-shot pass. All new credential cases and existing wallet cases passed in the full run.
- Local browser runner overrides: five-minute cold-build startup allowance and 60 seconds per test. Existing assertions were not removed or disabled. These are environment/test-run limits, not a hosted performance benchmark; no repository test configuration was changed.
- Screenshots: `/workspace/artifacts/proofpak-credential-redesign/credential-detail-1280-desktop.png` and `credential-detail-390-mobile.png`, with other 320/390/1280 variants. These are clearly illustrative offline records, not issued credentials or tested live blockchain transactions.

No new configuration or migration is needed for this UI change. Hosted publication, real signed-in acceptance, actual Incognito access to a published credential, and real devnet proof checks remain founder-led manual validation before release. PDF export is not implemented.
