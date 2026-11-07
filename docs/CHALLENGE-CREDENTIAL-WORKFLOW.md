# Challenge assessment and linked credential delivery

## Scope and reused functionality

Task 5 builds on `f7efd78` on `fix-wallet-specific-connection`. It reuses existing challenge publishing, submission/revision, feedback, company membership checks, achievement creation/evidence snapshots, category-scoped issuer approval and representative audit, credential acceptance/publication/revocation, public Passport cards, and the existing v3 Solana Memo flow. Paid projects and payment rules are unchanged.

Before this task, challenge approval created an achievement but had no rubric or direct link to a separately issued credential. A company could issue a general credential manually, with no enforced approved-work association. Those older records are retained, not reclassified.

## Updated journey

1. A company creates a challenge in `/portal/company/create`. It may add **zero to six** criteria, each with a short title and evaluation description. Publishing the challenge and its initial rubric is atomic; invalid criteria do not leave a partly created challenge.
2. Public challenge detail displays current criteria. In `/portal/company/challenges`, an authorized company member can save a new rubric version. Old versions are immutable. Criteria are public for published challenges; the author’s account ID is private.
3. An individual submits through the existing challenge detail form. Existing revisions/resubmission remain available.
4. In `/portal/company/reviews`, a reviewer records each current criterion as **Meets criterion**, **Needs improvement**, or **Not assessed**, plus the existing written feedback and decision. Approval requires all defined criteria to be met. The server rejects stale rubric IDs, missing outcomes, self-review and unrelated reviewers.
5. Each completed review gets an immutable criterion/outcome snapshot linked to its rubric version and review. A later rubric change does not rewrite it. Individuals see feedback and saved outcomes in My Activity/submissions; companies can inspect assessment history. Written feedback remains private to the existing parties.
6. Approval creates the existing **achievement only**, with the original approved-evidence snapshot. It does not create, accept, publish or anchor a credential.
7. The company chooses **Issue credential for this work**. This opens `/organizations?view=issue&submission=…`. The existing issuance form is prefilled with the work title and description, a server-derived recipient, applicable organization and permitted work-recognition types. The issuer can inspect recorded results before issuing. The source work and recipient cannot be substituted through client fields.
8. Only a currently authorized organization belonging to the challenge's owning company can issue the linked credential. Task 4’s category checks and authenticated representative audit still apply. The selected recipient can have a private profile: the existing approved submission supplies the relationship, rather than a private email/profile search. Ordinary unlinked issuance still requires its existing public-recipient/request rules.
9. The issuer explicitly submits the form. A new credential, private evidence/preferences, mandatory issuing-representative audit and immutable source link are committed together. A repeated issue for the same submission/type is rejected without leaving partial records. The original approved achievement remains separate.
10. The recipient opens **My Credentials**, sees the related challenge/work and original assessment, then accepts or declines. Publication remains opt-in and also requires a public Passport. **Also publish supporting evidence and assessment results** is an additional explicit choice. Acceptance alone never publishes anything.
11. A published credential shows its source challenge title. Structured assessment results are shown only with additional evidence consent; written reviewer notes and raw submission explanation never enter the public context. The public Passport uses the existing accepted-credential display and labels the related work.
12. Eligible accepted/current credentials may use the same linked issuer wallet, devnet Memo signing, finalized server verification and receipt recovery as before. No wallet, transfer, credential or proof is automatically created by assessment approval.

## Types and duplicate policy

The linked-work action supports the existing `company_achievement`, `certification`, `hackathon_participation` and `hackathon_achievement` categories, only when individually approved for the issuer. A practical challenge is **not** treated as a degree, course, bootcamp or workshop completion. Those direct-issuance workflows remain available under their existing rules. There is no automatic inference of an award or professional competence: an authorized representative makes a separate decision.

Database uniqueness is **one linked credential per submission and credential type**, including revoked credentials. Multiple distinct permitted types require separate explicit decisions. This prevents retry/duplicate settlement of an intended source credential, not semantic duplication through the unrestricted general issuance description field. A controlled linked replacement/correction lifecycle is not implemented; do not switch categories simply to evade this rule.

## Database changes

New forward migration: `supabase/migrations/202611050003_challenge_assessments.sql`.

| Object                         | Purpose / access                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge_rubrics`            | Immutable versioned criteria; raw author metadata visible only to company members. No client writes.                                                                                                                                              |
| `challenge_public_rubrics`     | Read-only fixed projection of ID/challenge/version/criteria for published challenges or their owning members; no staff ID.                                                                                                                        |
| `challenge_assessments`        | Immutable review/submission/challenge/rubric references and criterion/outcome snapshot; recipient and company members only.                                                                                                                       |
| `challenge_credential_sources` | Immutable credential-to-challenge/submission/review/organization/type link, manifest and digest; recipient and issuing members only. Unique submission/type.                                                                                      |
| `credential_challenge_context` | Consent-filtered public/private projection. Public title/reference requires credential visibility; structured results additionally require evidence consent. Never includes reviewer notes, raw work explanation, reviewer IDs or submitted URLs. |

Protected functions:

- `set_challenge_rubric`: company membership, criterion validation and serialized version creation under a challenge row lock.
- `create_challenge_with_rubric`: guarded atomic challenge/rubric creation.
- `review_assessed_submission`: original approval/revision behavior plus reviewer authorization, current-rubric check, supported outcomes and immutable snapshot.
- Existing `review_submission`: compatibility wrapper, still usable for rubric-free/empty-rubric work; cannot bypass nonempty criteria. It returns the same achievement UUID/null semantics.
- `issue_challenge_credential`: approved work, matching owning organization, existing achievement/evidence and approved review, current category permission, mandatory Task 4 attribution, immutable linkage and duplicate guard.

Existing `submission_reviews` gains an immutable update/delete trigger. Reviews continue to append normally during revisions. No existing rows are modified. Raw client insert/update/delete grants are not introduced; the new public views have SELECT only and intentionally use trusted-owner execution plus fixed fields and explicit visibility predicates.

## Commitment and Solana compatibility

No existing v1/v2/v3 serializer, Memo prefix, transaction signer, hash field or historical record changes. There is no custom Solana program or new blockchain claim version.

For **new linked credentials only**, SQL creates a version-1 assessment manifest containing the source challenge/title, submission/review/organization/recipient references, review timestamp, exact rubric criteria/outcomes, and the existing salted approved-evidence digest. It excludes private reviewer feedback, work explanation and raw evidence URLs. For old approved work without a recorded structured assessment, it deliberately uses empty criterion/outcome arrays, not invented grades.

The manifest’s PostgreSQL-canonical SHA-256 is placed in the existing v3-committed `program_name` field as `Assessed work · sha256:…`. This makes the source commitment part of the original v3 hash **without changing that format or historical meanings**. The certificate displays a readable challenge-recognition label; the commitment is available under the assessment integrity reference. Ordinary direct credentials retain their original program fields.

`assessmentJson` reproduces PostgreSQL `jsonb::text` key ordering/spacing. Real local PostgREST tests recompute a SQL-generated manifest’s digest with the application code. The credential verifier and proof preparation also check the program/reference relationship and, when visible, manifest integrity. A mismatch prevents confirmed integrity; adding unrelated context metadata to an older credential cannot change its original v3 serialization.

If results are private, a visitor can check the committed reference but cannot independently inspect/recompute the hidden assessment. Public evidence URL hashes do not freeze the contents of externally hosted files; use immutable Git commit/artifact URLs when appropriate. As before, a finalized matching Solana record proves commitment integrity, not that a reviewer was honest, an issuer accredited, a person competent, or an achievement true. Current issuer status, credential validity, consent and chain integrity remain separate.

## Security and privacy boundaries

- No self-review, unrelated-company reviews, or raw client writes to rubrics/results/source links.
- Rubric snapshots and review history cannot be rewritten. A stale assessment form is rejected rather than silently applied to changed criteria.
- Authorized membership in two companies does not permit issuing one company's work under the other organization's name.
- Pending/revision work cannot qualify. Task 4 rejects unapproved issuers, unpermitted categories and self-issuance, and records the actual authenticated representative.
- The recipient is derived from the approved submission, never an arbitrary private-account lookup.
- Source issuance is transactional. Its late uniqueness constraint rolls back the credential, evidence, preferences and actor audit together on duplicate requests.
- Publication/Passport visibility and evidence consent remain independent. Reviewer notes and submitted explanations are not included even when structured results are published.
- No new public view exposes rubric authors, issuing-staff UUIDs, private offers, wallets or payment receipts.
- Existing revocation, issuer suspension, historical verification, wallet ownership and payment settlement remain intact.

## Manual release prerequisites — not applied

1. Confirm the correct isolated test project and retain a usable backup/recovery point before a later production change. Hosted schema state is not established by migration files.
2. Apply all previously required reviewed migrations, including `202611050001_paid_project_public_privacy.sql` and `202611050002_issuer_trust.sql`. Task 4 category review is still necessary; this task grants no new categories.
3. Run `docs/check-challenge-assessments.sql` read-only. Before first application, expect new tables/views/functions absent, while challenges, reviews, achievement snapshots, credentials and Task 4 audit objects already exist. Unexpected objects require investigation, not a reset or rerun.
4. After explicit approval for the named project, apply the **complete** new migration once, inside its transaction. No initial/historical migration is rewritten or rerun. Retain the successful manual migration ledger.
5. Re-run metadata/count checks: three new RLS tables, two safe SELECT-only views, immutable triggers, protected RPC grants and unique submission/type constraint. Old challenge/submission/review/achievement/credential/proof counts and facts must be preserved; no old rubric or source attribution is backfilled.
6. Deploy matching code only after its schema exists. Public challenge readers and credential queries now require the safe views. Existing older rubric-free review clients remain supported, but new forms require the new RPCs. Do not deploy automatically or merge without approval.
7. In the isolated preview, manually test rubric creation, revision, approval, separate scoped issuance, private-profile recipient acceptance, consent withdrawal, public verification, and one independently approved real devnet proof when the founder is available. No hosted or wallet success is claimed from the automated checks.

Recovery: a failed SQL transaction rolls back. After a lost connection, inspect before retrying. Keep all historical records, source links and signatures; do not disable RLS, remove the assessment guard, delete new rows or change hashes to restore compatibility. Fix forward or select a schema-compatible deployment, coordinating public-view dependencies with the earlier privacy release guide.

## Automated validation

| Check                                       | Passed   | Failed | Skipped |
| ------------------------------------------- | -------- | ------ | ------- |
| Unit tests (`npm test`)                     | 66       | 0      | 0       |
| Database workflow/preservation suites       | 9 suites | 0      | 0       |
| Real local PostgREST privacy/workflow tests | 26       | 0      | 0       |
| Desktop/mobile browser suite                | 134      | 0      | 0       |

Lint, TypeScript, formatting and production build passed. A final focused browser rerun passed the same four new desktop/mobile cases (0 failed, 0 skipped); these are a subset, not four additional unique tests. Existing payment privacy, wallet ownership, issuer trust, consent and legacy-data regressions remain included. New tests cover rubric versions/outcomes, stale and unauthorized reviews, separate issuance, current category permissions, issuing actor, duplicate prevention, same-company enforcement, declined/private/public consent, closed-challenge recipient access, source commitments, SQL-to-application hash roundtrip, the actual full credential query and private staff/reviewer boundaries.

The initial browser run had two assertion failures from counting a hidden outcome option as published assessment content. The selector was corrected to inspect the assessment list; the fresh complete rerun passed all 134 cases. A unit fixture initially omitted finalized status and was corrected; production finalization requirements were not weakened.

Database and direct REST suites use isolated disposable PostgreSQL/PostgREST with synthetic accounts only. Cryptographic unit tests are offline fixtures, not real wallet evidence. Browser tests use the gated local fixture route and existing authentication guards, not hosted account login. No blockchain transaction is sent.

Logs: `/tmp/task5-lint.log`, `/tmp/task5-types.log`, `/tmp/task5-unit.log`, `/tmp/task5-format.log`, `/tmp/task5-build.log`, `/tmp/task5-db.log`, `/tmp/task5-rest.log`, `/tmp/task5-browser-final.log`, `/tmp/task5-browser-focused.log`. Intermediate test-development failures are not final acceptance results.

## Known limits / next task

- Human assessments are not independently audited; no scoring weights, appeals, second reviewer or formal accreditation is added.
- New rubric versions apply to subsequent reviews; submissions are not pinned to the rubric at initial submission. Reviewers must use the current version, and completed snapshots preserve the version actually used. A stricter participant-approved rubric-change policy is future work.
- Early revision review criteria/outcomes/feedback are retained; this task does not add full submitted-file history for each revision. Approved work retains its existing immutable evidence snapshot.
- Existing approved work can be recognized without structured criteria; that absence is visible. No fake rubric history is backfilled.
- Linked correction/replacement and automated notifications remain unimplemented. Recipients still open My Credentials to respond.
- The work action offers four existing recognition categories; academic/course-completion issuance is intentionally not inferred from a challenge.
- External evidence URLs can change and enforce their own document-host privacy. Private data is not put in the Memo.
- Hosted accounts, actual institutional review practice, real wallets and devnet transactions remain untested/postponed. Existing runtime dependency advisories are not resolved by this task.

Recommended next task: validate the complete challenge → assessment → separate credential → consent → public verification journey in the isolated hosted preview when the founder is available. Do not add another product feature before recording that evidence.
