# Task 16 — Credential lifecycle and independent verification

## Scope and existing foundation

Branch `credential-lifecycle-verification` starts at Task 15 `a09ad3a`, retaining Task 14 `f62941e`. No hosted changes, transactions, migrations, or proof-format changes are required by this task.

Existing issuance, immutable credential facts, explicit expiry dates, recipient acceptance/publication, revocation, correction chains, issuer-category permissions, institutional trust and consent-filtered assessment snapshots are reused. Anonymous visitors could already load published accepted credentials without an account or wallet. Real Solana verification already checks the immutable claim and finalized transaction independently of lifecycle.

## Genuine gaps and changes

- Pending or declined private credentials previously displayed the intrinsic date/status label “Current”. A new presentation helper shows **Active** only for accepted, date-valid records without revocation or supersession. Acceptance, publication and institutional trust remain separate.
- Historical integrity could be mistaken for current validity. A compact summary now explicitly separates current lifecycle, recipient/publication, current institutional trust and historical Solana integrity. A revoked, expired or superseded record can retain a matching historical proof while clearly being inactive.
- Visitors can recheck the current server-rendered state without authentication, wallet connection or a transaction. The live page reports its check timestamp in UTC. RPC/database failure does not produce a positive verification claim. Operational credential-query failures no longer masquerade as a missing record.
- Rendering additionally fails closed when an unpublished record is supplied without authorized private access. Assessment details are stripped from the presentation unless existing evidence consent or authorized private access permits them. Database policies remain the authoritative boundary.
- Received credential cards use the same lifecycle vocabulary.

## Transition rules (unchanged database lifecycle)

| Condition | Presentation |
| --- | --- |
| Issuer has revoked record | Revoked, including if it also has a replacement |
| Accepted correction has superseded record | Superseded |
| Explicit issue date is in the future | Not yet valid |
| Explicit expiry date is before today, UTC | Expired |
| Otherwise awaiting recipient decision | Awaiting acceptance |
| Otherwise declined | Declined |
| Otherwise accepted | Active |

An expiry date remains valid through that UTC calendar day. No expiry is invented for legacy records. Private/public is an independent visibility setting, not an assertion of validity. A pending replacement does not supersede its original. A declined replacement does not become active. An accepted private replacement supersedes its original but its identity and correction reason are not disclosed publicly. Existing safe lineage projections expose links only when publication permits.

Issuer suspension, trust downgrade or changes to current category permissions do not automatically revoke historical credentials. The page distinguishes current institutional review, current issuance permission, and authorization recorded at issuance; approval is not government accreditation or a guarantee of every assessment.

## Independent verification and its limits

Open `/credentials/<id>` in an Incognito browser for a credential accepted and published by its recipient, with a public Passport. No wallet or account is required. The page presents current status and issuer trust from ProofPak's database, consented assessment information, and an independently checked historical Solana commitment. Use **Recheck current status** for a fresh read. A stored Explorer reference alone is not a positive integrity result.

This is not a decentralized revocation registry: current validity, recipient consent and issuer trust still rely on ProofPak's server/database. Solana demonstrates historical data integrity, not skill competence, legal identity, accreditation or current validity. The current page continues using the existing v3 verifier; achievement v1/v2 verification and historical claims are untouched.

No new claim fields, hashes, transactions, lifecycle states or database objects are introduced. Tasks 14/15 migrations (`202611070002_organization_verification.sql`, then `202611070003_assessment_transparency.sql`, after their existing prerequisites) still need normal ordered review and application before deploying their matching code. This task adds no further migration.

## Regression evidence

See the final delivery for measured counts. New unit fixtures test derived status, UTC expiry boundary, trust independence, historical proof compatibility, consent redaction and truthful timestamps. New direct PostgREST cases test private pending/declined records, accepted private replacements, revocation, immutable original hashes and hidden correction reasons. Existing full database suites cover fresh and populated historical migrations, RLS, category permissions, supersession, revocation privacy and consent.

Browser tests exercise desktop/mobile status changes, private rendering, hidden replacement links, issuer downgrade independence, sharing, refresh without transaction APIs, and 320px layout. Fixture integrity outcomes are explicitly synthetic; these are not live wallet or chain tests.

## Required manual validation before production

1. Apply the existing Task 14/15 migrations to an isolated test database in filename order after a backup; no migration is added here.
2. Use separate recipient, authorized issuer and administrator accounts. Issue a credential, inspect pending/private state as owner, accept and publish it, then visit in Incognito.
3. Compare the public page before and after expiry, revocation, and recipient-consented correction; confirm private successor IDs/reasons and staff metadata remain hidden.
4. Suspend/downgrade the issuer and confirm current issuer labels change without automatic historical revocation.
5. With separately authorized wallet testing, anchor a real devnet record, compare finalized integrity before/after lifecycle changes, and refresh/recheck. No real transaction was performed for this task.
6. Verify production RPC availability and actual hosted RLS after deployment. Local tests do not establish production readiness.

## Measured automated results — Task 16

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Unit tests, final complete run | 105 | 0 | 0 |
| Database suites, including fresh 19-migration chain and populated historical fixtures | 18 suites | 0 | 0 |
| Direct PostgREST security tests, final complete run | 76 | 0 | 0 |
| Browser run 1, desktop + mobile, one worker | 200 | 4 | 0 |
| Browser run 2, desktop + mobile, two workers | 203 | 1 | 0 |
| Browser run 3, full desktop + mobile rerun, one worker | 204 | 0 | 0 |

Run 1 found two ambiguous test selectors in both browser projects: multiple `role=status` elements after adding recheck feedback, and two visible “Declined” labels representing separate lifecycle/recipient checks. Assertions now target the intended clipboard feedback and lifecycle status explicitly. No application security or lifecycle rule was relaxed.

Run 2 passed all credential cases but the existing desktop dashboard navigation test timed out waiting five seconds for its destination heading. Immediate navigation feedback assertion had passed. The unchanged navigation test and the full 204-case suite passed in run 3 with one worker. Treat the parallel-run timeout as an observed test reliability limitation, not proof of a fixed production performance issue. No assertions or timeouts were weakened and no navigation code was changed.

The existing 73-case REST suite passed before adding the three lifecycle cases; its final complete 76-case run also passed. All database and REST checks used disposable local PostgreSQL/PostgREST instances with synthetic data. Browser tests used explicitly labeled fixtures and configuration-free routes; they do not replace real hosted account or wallet acceptance testing. Lint, TypeScript, formatting and production build are checked separately before the local commit.

Final `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` all completed with exit code 0. Production build completed successfully. No hosted authentication, hosted RLS, live RPC verification or physical-wallet test was performed.

Key implementation references: `src/lib/credential-lifecycle.ts` (derived status), `src/lib/credential-presentation.ts` (consent-aware assessment rendering), `src/components/credential-detail.tsx` (separate public checks), `src/components/credential-recheck.tsx` (read-only refresh), `src/components/credential-record.tsx` (consistent inbox/Passport status), and `src/app/credentials/[id]/page.tsx` (dynamic RLS-backed verification and honest query failures). Existing `src/lib/credential-verification.ts`, `credential-proof.ts` and `credential-solana.ts` are unchanged.
