# Credential correction and supersession release guide

## Scope and cause

The assessed-work source table previously enforced a unique `(submission_id, credential_type)` pair for every issued record. Revocation did not release that constraint. The old instruction to revoke and issue another credential therefore could not correct challenge-linked records. General credentials also had no controlled replacement relationship.

This change adds a separate immutable correction lineage, not editable credential facts. It does not create a new Solana format, payment behavior, network or migration backfill.

## Workflow

1. An authorized representative opens **Organizations → Issued credentials → Create a corrected replacement**.
2. Enter a private reason, corrected facts and dates, then confirm. The organization, recipient and category are fixed by the server. Category permission and organization approval are checked again.
3. A new credential and private, pending preferences are created atomically. No old facts, evidence, hash, proof or consent are copied or rewritten. Issuing representative and current approval are recorded by the existing issuance audit.
4. The recipient opens **My Credentials**, reviews the relationship, then accepts or declines. Publication and evidence sharing are separate opt-ins. Private correction reasons and staff IDs are not in the recipient/public projection.
5. Acceptance requires a currently valid, non-revoked replacement and an issuer still authorized for that category. Only then does the original become superseded. This remains true even if the recipient keeps the replacement private.
6. Accepted, current replacements can use the existing v3 wallet anchoring flow. It requires a real finalized transaction and server verification. No transaction was sent during this task.

### Rules

- Revocation takes precedence over supersession. A revoked original is never restored.
- A pending replacement does not supersede the original. Declining a pending proposal closes it permanently; an issuer may create another proposal for the same original.
- Revoking a pending proposal withdraws it. A fresh proposal is then possible. Revoking an already accepted replacement does not reactivate earlier records.
- Withdrawing acceptance after a correction was accepted does not undo supersession. Publication can still be withdrawn. This avoids silently reviving a known incorrect record.
- One pending or accepted successor per original is enforced by a partial unique index and original-row locking. Corrections continue from the current accepted leaf, not an older ancestor. Chains are limited to 20 records, after which operator review is required.
- Corrections retain category. Changing the category is deliberately unsupported; it needs a separate explicit issuance decision, not a correction loophole.
- Challenge-linked replacements retain the original submission, review, assessment manifest, context digest, program and evidence URL. New supporting evidence or a new assessment requires the appropriate assessment workflow, not silent modification.
- The initial-work uniqueness rule still applies to all ordinary issuance. Replacement source records require a valid correction edge and exact inherited source, including the initial root credential.

## Solana compatibility

Existing v1/v2/v3 serializers, claim fields and verification rules are unchanged. Existing claims and receipts are not rewritten. A replacement uses a new credential ID, timestamp and evidence digest with the current v3 mechanism.

Its description includes a `Correction reference sha256:…` suffix committing to the predecessor's high-entropy credential UUID. This binds lineage through the already supported description field without introducing a new format or exposing a private predecessor UUID in a public description. The private reason and representative are excluded. The form strips the prior suffix when proposing a subsequent correction. Public navigation links are provided separately only when the relevant record is visible.

Historical proofs can still verify integrity while the credential is revoked or superseded. Integrity is not validity, legal accreditation or proof of skill. New proof recording for superseded records is blocked; existing proof rows remain intact.

## Database migration and release order

New file: `supabase/migrations/202611060002_credential_corrections.sql`.

Dependencies: the complete existing chain, in filename order, through `202611060001_credential_revocation_privacy.sql`, including issuer trust, challenge assessments and employer discovery. This migration uses their tables/functions. Do not reapply earlier migrations to an existing project.

Before release, an operator must:

1. Confirm the intended Supabase project, its applied migration history, and a usable backup/recovery export. Use an isolated preview project first; never use production accounts for fixtures.
2. Run `docs/check-credential-corrections.sql` read-only. Required dependencies must exist; pending migration objects must not already exist. Stop on mismatches, unknown schema drift or an already-applied migration. Retain row counts and the historical-record fingerprints privately.
3. With explicit owner approval, apply the complete new migration once in its included transaction. Do not run fragments or replace historical migrations. Failure rolls back the transaction. Do not drop the initial uniqueness constraint manually.
4. Run the read-only checks again: new table, RLS, staff audit policy, new column, unique indexes, safe view, relationship and RPC must exist; raw public write grants must be false. Credential, evidence, preference, proof, event and initial assessment record fingerprints/counts must match the retained baseline (if no concurrent application activity occurred).
5. Deploy the matching application code to preview, then run the manual tests below. No environment variable changes or new secrets are required.
6. Only after approval, coordinate the same migration-before-code order for production. New code cannot query a database missing the new status view. Existing code does not understand supersession; avoid an extended mixed-version window and do not perform correction operations until all app instances run the matching code. Older clients may show stale validity until refreshed.

The migration adds `credential_corrections`, a nullable `challenge_credential_sources.correction_root_id`, guarded RPCs/triggers, a safe correction-status view with an explicit PostgREST relationship, and replacement-aware proof-recording/search functions. Existing source rows remain initial roots with NULL `correction_root_id`. No historical facts or receipts are altered.

### Privacy boundary

Raw correction audit reads are restricted to organization members and platform administrators by RLS; API roles have no insert/update/delete privilege. The authenticated correction RPC derives actor, organization, recipient and category. Platform administration alone does not permit issuing for an organization. Issuance still requires existing membership/category checks.

Recipients and public visitors use only `credential_correction_status`. Pending successor IDs and decision state are visible only to the recipient and issuer members. Public links require record visibility. Accepted supersession is shown on a visible historical original, even when the replacement is private; its private ID/details/reason remain hidden. The public view returns no actor or private reason. The helper RPC cannot reveal a private original or successor. Task 9's revocation view and raw-audit permissions are preserved.

## Validation and manual acceptance

Automated tests use disposable PostgreSQL/PostgREST fixtures and offline browser presentation controls. See the final delivery for exact run counts. These do not prove hosted Auth, real-user usability, RPC availability or physical-wallet compatibility.

Using separate test issuer/recipient/admin accounts:

1. Publish an accepted credential and record its URL, claim hash and existing signature.
2. Create a correction. Confirm original remains current, new credential is private/pending, private reason is visible only in issuer/admin audit, and no historical receipt changed.
3. In an unrelated/incognito browser, confirm pending correction is inaccessible and absent from public lineage. Check direct REST, not just rendered UI.
4. Decline it. Confirm original stays current; reaccepting the closed proposal fails. Submit a fresh proposal.
5. Accept the fresh proposal privately. Confirm the old public URL says superseded with no private successor link. Publish it explicitly, then check both public lineage links.
6. Correct an assessed-work credential. Confirm submission, review, assessment digest and evidence remain identical; ordinary duplicate issuance is still rejected.
7. Suspend the issuer or remove its category permission before acceptance. Confirm acceptance fails. Restore approval through the real administrator review process, then retry.
8. Revoke the original and confirm it remains revoked after corrections. Revoke a pending correction and confirm it cannot be accepted; a new proposal is possible.
9. Attempt two simultaneous corrections. Only one may persist. Test cross-organization and recipient correction requests: both must fail.
10. With separate explicit permission, anchor the accepted current replacement on devnet and verify the real finalized receipt. Recheck the old historical proof. Do not create another transaction to repair an unknown transaction outcome; use existing recovery.

## Recovery

Do not delete correction rows, undo supersession by changing SQL fields, or restore old database snapshots over newer payments/proofs. Correct erroneous facts with another authorized replacement; revoke an invalid pending proposal. Keep revoked history intact. An accepted correction cannot be rolled back into an active original automatically.

If the migration fails, its transaction leaves the old schema in place; investigate before retrying the complete file. If code deployment fails after a successful migration, leave the additive database changes in place, pause correction operations, and roll application code back only as a short-term operational measure: old code does not display supersession. Prefer a forward code fix. Preserve all signatures and audit exports.

## Limitations

No editable/reassessed source evidence, category changes, reversal of accepted supersession, institutional identity verification, or appeal process is added. Revocation reasons remain the existing explicitly public lifecycle explanation, separate from the new private correction reason. The 20-record chain cap needs operator review, not a client bypass. Real hosted accounts and actual wallet transactions require founder-led acceptance testing.

### In-progress historical proof caution

Finish or reconcile an already signed original proof before accepting its replacement. Once superseded, the normal proof API and database reject new proof recording for that old record. Already stored historical proofs remain verifiable. If a historical transaction succeeded but was never recorded before supersession, retain its original signature/signed bytes and request operator review; do not sign another transaction. This task does not add an administrative override of proof validity checks.

## Local validation results

| Check                                              | Passed | Failed | Skipped | Scope                                                                                                                                 |
| -------------------------------------------------- | -----: | -----: | ------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (`npm test`)                            |     90 |      0 |       0 | Includes original v1/v2/v3 behavior and new correction status/hash assertions                                                         |
| Database suites (`npm run test:db`)                |     13 |      0 |       0 | Fresh migration chain, read-only release checks, correction/assessment/consent/security and populated historical upgrades             |
| Direct PostgREST security (`npm run test:privacy`) |     53 |      0 |       0 | Disposable local PostgreSQL/PostgREST; concurrent correction, field privacy, authorization, receipt and previous workflow regressions |
| Full browser run (desktop/mobile)                  |    173 |      1 |       0 | 174 cases; one existing dashboard-navigation test timed out locating My Activity                                                      |
| Focused navigation retry (both projects)           |      2 |      0 |       0 | Passed without code/test changes; original timeout cause not established                                                              |

All six new correction browser cases passed on the original full run. Browser tests use explicitly offline fixtures and unauthenticated access checks, not hosted authenticated users. All 174 distinct browser cases have a passing result across the full run and focused retry; this is **not** a claim of one clean 174/174 run.

Lint, TypeScript, repository formatting checks and the final explicit `npm run build` passed (exit 0). No dependencies were changed. During development, database/REST runs exposed and helped fix helper access and PostgREST relationship issues. Early REST results were 38/51, then 50/51 and 51/52 while a test assertion used `manifest` instead of the public projection's `assessment` field; the final expanded suite passed 53/53.

No hosted migration, production write, real-wallet interaction or Solana broadcast was performed. Founder-led preview acceptance and real-device tests remain required.
