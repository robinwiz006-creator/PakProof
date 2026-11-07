# Organization verification and issuer trust

## Scope and starting point

Branch: `issuer-organization-verification`, created from freshly fetched `origin/main` at `fcf4409` (merge of PR #8). The previous feature branch and three untracked audit documents are preserved. This task does not push, merge, deploy, change production settings, apply hosted migrations or send blockchain transactions.

Already implemented: organization registration, memberships, independent platform administrators, credential-category permissions, immutable authorization history, issuing-representative attribution, recipient consent, revocation/corrections and independently checked Solana proofs. Those systems are reused. Category authorization previously had no separate institutional identity/assessment level or organization evidence-submission process.

This change adds one private request table and extends the existing organization/authorization audit. It does not create a second issuer account system, trust token, legal identity service or blockchain proof format.

## Trust model

| Current level              | Meaning                                                                                            | What it does not establish                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Self-registered            | Organization account exists; identity has not been independently confirmed through this process    | No automatic trust from organization type, payment, wallet ownership, past category approval or submitting evidence |
| Verified Organization      | An independent ProofPak administrator reviewed institutional identity and representative authority | No assessment-standards review, government accreditation or guarantee of every credential                           |
| Trusted Assessment Partner | Institutional identity plus assessment standards and supporting evidence were reviewed separately  | No independent guarantee of every assessment result, qualification or skill claim                                   |

Suspension removes current verified/partner claims and displays **Self-registered · Verification suspended**. It is a warning/state, not a fourth trust level. Rejection of a new request preserves whatever current level/suspension already exists; it does not silently revoke a previous approval. Downgrade must actually lower the current level. Fresh approval requires a new undecided request and current evidence; an old decision cannot be replayed to reinstate trust.

**Trust and issuance permission are separate.** Trust changes neither grant nor remove categories. An institutionally verified organization with no explicit category approval still cannot issue credentials. A previously category-authorized organization may remain institutionally self-registered, or institutionally suspended, while retaining its separately approved categories. If new issuance should stop, the administrator must explicitly suspend credential authorization using the existing permission controls. This separation is stated in the review form and confirmed before saving. Historical credentials are never implicitly revoked by a trust change.

All existing organizations start at Self-registered after migration, including previously authorized issuers. There is no promotion/backfill from old review notes, names, types, wallets or credentials. Existing permission arrays/authorization references are unchanged.

## Organization journey

1. Open **Organizations → Overview**. Each organization has an institutional verification section, its current level, and separate category permissions.
2. Expand **Request organization verification**. Provide institutional identity/representative authority, your organizational role and an HTTPS evidence link. To seek partner status, also provide assessment standards and an HTTPS assessment-evidence link.
3. Do not submit passports/national identity cards, student records, passwords or other sensitive personal documents. There is no file-upload field or storage bucket. Prefer institutional evidence suitable for this purpose. External links are not fetched/copied by the server; their own access policies remain the provider's responsibility.
4. Submission is private to current organization members and platform administrators. It grants no trust or issuance permissions. One undecided request is permitted per organization; at most three submissions per rolling 24 hours.
5. See request history and a safe outcome/date/level after review. Members cannot read the administrator's private reason or staff UUID through the outcome view. A rejected/stale request can be followed by a fresh submission, subject to limits.

Private request identifiers stay in private request/audit records, not public organization columns. Public organizations expose current level, suspension state and the current trust-audit reference, which contains no administrator identity or review notes. Evidence remains private even if the organization has issued a public credential.

## Administrator journey

1. Sign in as an existing platform administrator who does not belong to the organization.
2. Open `/issuer-admin`. The existing issuer queue has **Institutional requests awaiting review**, a count and a filter. Search and pagination use the server-side private queue; unrelated users cannot query that queue.
3. Open the existing organization review page. Read private submitted information/evidence and the current institutional level. Open external links manually with care; a website URL alone is not identity verification.
4. Choose approve, reject, suspend or downgrade and a supported target level. Approval requires confirming current institutional identity and representative authority. Partner approval additionally requires a substantive assessment statement, evidence link and explicit assessment-review confirmation.
5. Enter a private reason and confirm the decision. Approval/rejection must target the latest undecided request. Suspension/downgrade do not need a new request. Optimistic expected-review checks and row locks prevent stale/concurrent decisions from overwriting another review.
6. The existing **Private authorization history** records institutional decisions distinctly from category decisions: administrator UUID, date, reason, previous/resulting level, suspension state and request reference. Existing category history remains intact. Category controls are labeled separately.

Self-review is blocked in the interface and database, including when an organization member is also a platform administrator. Trust decisions require independent authority, not a company payer or issuer wallet.

## Database and privacy controls

New forward migration: `supabase/migrations/202611070002_organization_verification.sql`, following the existing chain through `202611070001_contact_handoff.sql`. No historical migration is rewritten.

- `organizations` adds `trust_level` (conservative default), `trust_suspended` and `trust_review_id`. A trigger rejects trusted states on registration and requires a matching independent administrator audit for changes.
- `organization_verification_requests` stores immutable private submissions and an identity digest of the company name, description, website and organization type. Current members and administrators can read; API roles cannot write it directly.
- `issuer_authorizations` gains nullable institutional decision/snapshot/request/previous-review fields. Old rows retain NULL values. Existing rows remain immutable. Category `authorization_id` is not replaced by a trust review.
- Unique initial-review/successor indexes and the previous-review reference provide a linear trust-decision audit and prevent replay/concurrent successor conflicts. Private reasons and administrator identifiers remain behind the existing administrator-only RLS.
- `organization_verification_outcomes` exposes only safe result fields to members/admins. `administrator_verification_queue` is administrator-only and contains pending-organization metadata, not evidence/notes.
- `submit_organization_verification` derives the submitting user and checks membership, serialized pending/daily limits and evidence constraints. `review_organization_verification` checks independent administration, current request, identity snapshot, expected review, level transitions and required confirmations.
- Reviewed identity changes remain locked. The existing company identity trigger is extended to institutionally reviewed/suspended organizations that have not received category approval. Pending identity edits invalidate the submitted digest; stale evidence cannot be approved.
- A new request does not immediately affect public trust. Only a completed administrator decision updates the current level. The public UI explains that current verification is separate from approval at credential issuance and Solana integrity.

No new public evidence endpoint, automatic identity lookup, uploads, service credentials or environment variables are introduced. The server actions use the existing authenticated Supabase client; no service-role access is needed for the new workflow.

## Credential and Solana compatibility

Credential issuance permissions and insertion checks are unchanged. Credential acceptance, visibility, corrections, revocations, assessment snapshots and paid-project workflows are unchanged. Public credential cards/details and the organization/admin pages display the issuer's **current** institutional status.

No v1/v2/v3 serializer, claim hash or transaction format is modified. New trust metadata is not injected into historical claims. Solana proofs attest to the original committed credential data, not today's trust level, real-world accreditation or truth of the skill. Existing private audit snapshots retain the history; this change does not claim a public onchain trust/revocation registry.

Legacy migration tests compare original authorization fields and explicitly assert the newly added historical fields are NULL. New-column defaults are not mistaken for historical fact rewrites. Populated credentials, receipts, revocations and authorization snapshots remain preserved.

## Release prerequisites and recovery

1. Review the new migration and actual target project's applied history. Latest main containing migration files does not prove production applied them. Keep a verified recovery export and preserve record counts/fingerprints.
2. Run `docs/check-organization-verification.sql` read-only before/after in an isolated authorized environment first. Confirm dependencies, pending objects, privacy grants, policies, constraints and unchanged historical fingerprints. Do not rerun the initial migration, fixture SQL or bootstrap scripts in hosted Supabase.
3. With separate approval, apply only the new outstanding migration in its included transaction after its dependencies. Failure rolls back that file; stop and investigate drift rather than running fragments.
4. Deploy the matching application code only after the new columns, views and RPCs exist. Old code ignores the additive trust fields and its category behavior is unchanged; do not perform new institutional decisions until all serving instances use the matching UI. New code needs the migration.
5. Bootstrap administrators only through the existing owner-controlled process if the environment lacks them. Do not auto-promote company owners or approve real institutions for a demo.
6. Complete the manual walkthrough below before production use. This implementation did not apply a hosted migration or change a production environment.

If migration fails, retain the original schema and investigate the transactional error. After a successful migration, preserve the new audit/request records. Prefer a forward fix and paused review operations over dropping fields/tables or restoring an old database over newer credentials/payments. Do not rewrite historical credential hashes to accommodate trust changes. A code rollback must consider that old pages do not display institutional suspension/current trust distinctions.

## Manual acceptance still required

Using synthetic organizations and separate member/admin/outsider accounts:

- Confirm an old category-authorized organization is Self-registered and still has the same category rights.
- Submit institutional evidence; verify the owner/admin see it, while a credential recipient, unrelated organization and Incognito visitor cannot read it through UI or REST.
- Verify the pending queue count/filter, search and pagination. Reject a request, read the member-safe outcome and submit a corrected request.
- Confirm administrator-member self-review fails. Check valid-column direct REST PATCH attempts cannot change trust.
- Approve identity only and check the current public credential label says Verified Organization, without assessment claims. Upgrade only after fresh assessment evidence and confirmation.
- Downgrade/suspend and confirm public badges update, private reasons/administrator IDs stay private, and category rights/old claims remain unchanged. Explicitly suspend category authorization separately if issuance must stop.
- Edit a still-pending unreviewed organization's identity, then ensure stale evidence cannot be approved. Review and resubmit current information.
- Verify real existing published credentials, corrections, revocations and historical proof pages after migration, without broadcasting a new transaction.
- Test desktop, 320px and 390px with keyboard/confirmation controls. A hosted build or local fixture is not evidence of actual institutional verification.

## Limitations

Human review remains a trust dependency: administrators must follow a real identity, representative-authority and assessment-review policy outside ProofPak. This is not government accreditation or automated access to institution records. The software records and enforces decisions; it cannot prove the reviewer did a truthful investigation.

No document uploads, sensitive identity-document collection, automated external-link fetching, notifications, public organization directory/profile redesign, legal accreditation integration, automatic expiry/reverification or issuer appeal workflow is added. Evidence and review history are retained privately and immutable; organization members can read submitted evidence while they remain members. External evidence links can change or disappear. A formal retention/incident-handling policy is still needed before wider evidence collection; do not use this feature to collect sensitive personal identity documents.

Review-protected organizational identity edits still require a controlled administrative process. Trust suspension deliberately does not suspend category permissions automatically. A private request history is limited to the latest 20 displayed submissions; administrator history shows the existing latest 50 decisions. The private pending queue remains paginated.

No real institution was verified, no physical wallet was used, and no hosted database or production deployment was validated by this task.

## Validation results

| Check                                         |    Passed | Failed | Skipped |
| --------------------------------------------- | --------: | -----: | ------: |
| Final unit suite                              |        97 |      0 |       0 |
| Final isolated database suites                | 16 suites |      0 |       0 |
| Final direct PostgREST security suite         |        67 |      0 |       0 |
| Initial full desktop/mobile browser run       |       188 |      2 |       0 |
| Second full browser run                       |       188 |      2 |       0 |
| Final affected credential/trust browser rerun |        24 |      0 |       0 |

Lint, TypeScript, repository formatting and the explicit production build passed (exit 0). The final 24 browser cases are a subset of the 190 unique cases, not 24 additional unique tests. All 190 distinct browser cases have passing results across the full run plus focused rerun; there was not a final clean 190/190 full execution.

Initial browser failures were exact label lookup for the two new administrator selects, fixed with explicit accessible names. The next full run passed all eight new trust cases but found two older assertions still expecting the previous generic approval wording. Those assertions were updated to require the new distinction between credential-category authorization and institutional verification; the affected desktop/mobile suites then passed 24/24. No trust/privacy assertion was removed.

During database test development, whole-row historical audit comparisons flagged newly added NULL columns as a difference. Tests now compare every original field and explicitly reject invented historical trust values; populated claims, receipts and private authorization/revocation history pass preservation checks. An early REST run passed 65/67 because its test helper treated an undefined anonymous role as its default administrator; the test now explicitly uses an unauthenticated role. Final tests verify real anonymous denial, valid-column direct PATCH denial, concurrent review rejection and private evidence isolation. No production privilege was relaxed.

Tests use disposable PostgreSQL/PostgREST with synthetic accounts and gated offline browser illustrations. No hosted Auth, real institutional investigation, physical wallet, live Supabase policy state or production deployment was validated. Existing payment and Solana compatibility checks are offline regressions, not newly broadcast transactions.

Workspace logs: `/tmp/trust-{unit,db,rest,types,lint,format-check,build}.log`, `/tmp/trust-browser.log`, `/tmp/trust-browser-final.log`, `/tmp/trust-browser-focused.log`. These are temporary local artifacts, not production evidence.
