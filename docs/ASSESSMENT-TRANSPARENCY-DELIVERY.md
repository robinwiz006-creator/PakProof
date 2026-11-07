# Credential assessment quality and transparency — Task 15

## Foundation and scope

Feature branch: `credential-assessment-transparency`, created directly from Task 14's local commit `f62941e` on `issuer-organization-verification`. Task 14 is included by ancestry; this work did not start from main. No push, merge, deployment, hosted migration, environment change or blockchain broadcast is performed.

Existing functionality reused:

- Versioned challenge rubrics and immutable per-review criterion/outcome snapshots.
- Authorized company reviewers, private feedback, revisions and approved-work achievements.
- Separate, category-authorized credential issuance linked to the approved submission/review.
- Private reviewer attribution in `submission_reviews` and issuing-representative attribution in the existing credential audit.
- The original approved evidence snapshot, one selected credential evidence URL, and recipient acceptance/publication/evidence controls.
- Task 14's independent institutional trust levels and category permissions.
- Immutable correction lineage, revocation and historical v1/v2/v3 proof verification.

What was missing: a recorded method, explicit competency/result explanation, optional score/date, frozen challenge-level context and an employer-readable summary tying these together. Historical rubric results alone do not establish an unrecorded method or score.

## What changes for users

### Reviewer

The existing pending-submission review form has an optional **Record what was assessed and how** section. When enabled, record:

- One to eight actual competencies, rather than automatically copying advertised challenge tags.
- One primary method: practical project, code review, written test, interview or portfolio review.
- A publication-ready result summary of 20–1,500 characters, separate from private candidate feedback.
- An optional assessment date, never a future date.
- An optional whole-number score and maximum together (maximum at most 1,000). No percentage, pass threshold, platform ranking or standardized equivalence is inferred.

The challenge's existing difficulty is captured at review with a definition; there is no duplicate editable difficulty system. Beginner means a bounded task using standard approaches with guidance where needed; Intermediate means independent delivery of multi-part work and explained decisions; Advanced means complex constraints and justified independent trade-offs. These describe the challenge context, not the person's overall skill level.

The evaluating company name and reviewer-accountability flag are derived on the server. A client cannot supply a different organization or public reviewer UUID. The actual reviewer's authenticated ID remains in the existing private review record. Approval still requires every defined criterion to be met; a score alone does not approve work. Reviewers must not put private feedback, contact details or sensitive data into a proposed public summary.

Review history in the existing individual/organization portal and the linked credential-issuance preview show the recorded details. Approval still creates an achievement, not a credential. A separate category-authorized issuance decision is still required.

### Recipient and employer

The credential's existing public/detail route shows:

- The issuer and its current Task 14 institutional trust level, separately from category authorization, recipient consent, validity and Solana integrity.
- The original challenge and immutable assessment criteria/outcomes.
- Competencies, method, evaluator result, score if recorded, challenge level/definition and evaluating organization when assessment sharing is permitted.
- The review-recorded date, plus the optional evaluator-reported assessment date. A missing actual assessment date is stated as not recorded, not replaced with an assumed exam date.
- Authorized reviewer attribution without publicly publishing a staff account UUID, contact information or private notes.
- The existing permitted supporting-evidence link, independently gated by the same recipient consent. Other original submission links/content are not automatically published.
- Existing revoked, superseded, expired and recipient-decision warnings/links remain intact.

The page explicitly says this is the organization's assessment and ProofPak has not independently rescored the work. A Trusted Assessment Partner level does not independently guarantee this particular result. A numerical score is reported by the evaluator, not a ProofPak quality ranking.

If metadata was not recorded, the existing criteria/outcomes remain useful and the missing method, competency summary, level and score are clearly acknowledged. A direct/non-challenge credential has a concise notice that no structured assessment record is attached; this does not imply no assessment ever took place. No historical facts are invented from today's challenge fields.

## Privacy and consent

Credential publication alone does **not** publish assessment methods/scores. The existing accepted/public credential and public Passport gates remain, and the existing **Also publish supporting evidence and assessment results** choice controls the full assessment manifest. Owners and issuer members can inspect it privately before acceptance.

There is no new evidence record or upload system. Existing immutable approved evidence and the selected credential URL are reused. Private reviewer feedback, raw candidate explanation, secondary unchosen links, email/phone information, institutional verification evidence and internal organization records are never automatically copied into the new manifest. Client-supplied unknown fields are discarded by a whitelist.

Private raw assessment/source tables retain their existing RLS and read-only API grants. Public callers read only the existing consent-filtered context projection; filtering that projection by a hidden score/method does not reveal private results. Withdrawal of sharing/publication removes that public view of the assessment, but cannot erase information somebody previously saw after valid publication.

## Data and integrity design

New forward migration: `supabase/migrations/202611070003_assessment_transparency.sql`.

- Add nullable `challenge_assessments.details`. Old rows remain NULL; existing immutable-row triggers also protect this column. No historical row is enriched/backfilled.
- Add `review_assessed_submission_details`, which uses the same reviewer/submission/rubric authorization and outcome rules and writes the details in the original review transaction. It validates supported methods, bounded competencies/summary, integer score pairs and date.
- Preserve the old five-argument `review_assessed_submission` RPC as a wrapper supplying NULL details. The old three-argument review flow still works for rubric-free reviews. Omitting details remains valid; no fake defaults are introduced.
- Extend new `issue_challenge_credential` executions: if the approved snapshot has details, include them in a **schema-2 assessment manifest**. Otherwise retain the existing schema-1 manifest construction. Existing issued source records are never rewritten.
- New schema-2 manifests include a random context salt, using the issuance's generated salt. It makes low-entropy hidden metadata harder to guess from the public commitment. The salt is inside the consent-filtered manifest, not a public additional field or a private key. Corrections preserve the complete source manifest and its salt.
- The existing program-field digest commits the complete manifest through the existing **Solana v3 credential format**. There is no new blockchain format, memo program, wallet flow or custom contract. v1/v2/v3 serializers are unchanged. Schema 2 here names a nested assessment snapshot, not a Solana claim version.
- PostgreSQL/TypeScript canonical-hash checks cover actual schema-2 JSON, including the optional details and salt. Altering method, result, date or evaluator context changes the commitment. Without public assessment consent, verification can compare the stored context commitment but does not claim to reveal/recompute hidden facts for an anonymous observer.

### Corrections and historical limitations

Assessment snapshots are immutable from review onward. Later challenge difficulty/skill/rubric edits do not change them. Credential correction still creates a new record through the existing controlled replacement process, with fresh recipient consent. For challenge-linked corrections, the original approved manifest, rubric, evidence and assessment context are preserved exactly. Revocation changes validity without rewriting that history or its proof.

This task deliberately does **not** permit changing an issued assessment's method, score or evidence through a certificate-title correction. Incorrect assessments require revocation where appropriate and a legitimately fresh assessment/source under existing authorization rules; a richer assessed-source amendment process would need a separate reviewed design. Do not edit approved rows or bypass duplicate prevention to repair a mistake.

Optional explanation is added to the existing challenge-review workflow, not arbitrary university/direct credentials. Legacy and direct credentials can remain valid without it. This is not a new assessment marketplace or a general external exam-import feature.

## Task 14 compatibility

The branch includes `f62941e`. Current trust metadata is still separate from category rights and historical credential facts. This migration does not approve organizations, alter trust levels, grant credential types or change the Task 14 private verification/audit boundaries. A reviewer is authorized through existing company membership; issuance still requires the current category permission and authorized organization status.

No payment, wallet, contact handoff, organization registration or Solana settlement logic is changed. No dependency or environment-variable change is required.

## Release order and manual checks

1. Review the actual target project's schema/history and a usable recovery point; source files do not establish hosted migration state. No hosted state was inspected or changed here.
2. Apply only outstanding prerequisites in filename order. This feature branch needs Task 14's `202611070002_organization_verification.sql` before the new `202611070003_assessment_transparency.sql`, after the existing prior chain. Never rerun initial SQL or local test-bootstrap/fixture files in hosted Supabase.
3. With explicit authorization, apply the complete new migration once in its transaction. Run `docs/check-assessment-transparency.sql` read-only before/after in a quiet window to compare original rows/fingerprints and grants.
4. Deploy matching code only after the new column and RPC exist. Existing old review signatures remain compatible, but old pages do not show the new details: activate detailed review/issuance only when the matching interface is serving all instances. New code's private history queries require the new column.
5. Keep existing issuer/category controls, acceptance/privacy settings and wallet configuration. No trust approvals, credential records, example winners or test data are inserted in production by this implementation.

Manual hosted acceptance still needed:

- Use separate organization reviewer, issuer, recipient and unrelated accounts. Create a challenge/rubric and review a real test submission, recording only actually performed assessment work.
- Attempt an unrelated/self review and a valid-column raw assessment update; both must fail. Test bad method, future date, partial score and stale rubric failures without creating partial review records.
- Approve with recorded metadata, then separately issue a permitted linked credential. Check the private issuer/recipient preview against the original work and private reviewer audit.
- Accept and publish without evidence sharing. In Incognito and direct REST, confirm no method/score/summary is exposed. Opt in to evidence/assessment sharing and confirm exactly the permitted record and selected evidence link appear.
- Change the current challenge/rubric and confirm the issued record stays the same. Create a controlled credential replacement: new consent is required and the original assessment remains unchanged. Revoke and confirm validity changes while history stays readable under consent.
- Open older schema-1, direct, corrected and revoked credentials; missing metadata must remain unknown rather than fabricated. Recheck a historical v3 proof through the existing verification interface; do not broadcast new transactions without separate permission.
- Test desktop, 320px and 390px, current institutional labels, numeric/unscored assessments, optional date, error recovery and privacy withdrawal.

If migration fails, its transaction rolls back; investigate instead of running fragments. After records are created, prefer a reviewed forward fix and paused review/issuance over dropping metadata or restoring an old database over newer credentials/payments. Preserve originals, signatures and existing correction/revocation controls. No administrator mark-verified or historical edit override is introduced.

## Automated validation

| Check                             |    Passed | Failed | Skipped |
| --------------------------------- | --------: | -----: | ------: |
| Unit tests                        |       100 |      0 |       0 |
| Isolated database suites          | 18 suites |      0 |       0 |
| Direct PostgREST security tests   |        73 |      0 |       0 |
| Full desktop/mobile browser tests |       196 |      0 |       0 |

Lint, TypeScript, formatting and the explicit production build passed (exit 0), after the functional suites. The browser suite passed on its first full Task 15 run without retries. No Task 15 unit/database/REST/browser test failure occurred. Database and REST suites were rerun after adding the context salt, read-only release checks and populated legacy assessment upgrade checks; the latest counts above refer to final runs, not sums of repeated cases. No checks or assertions were disabled.

Database tests apply the complete 19-file chain to disposable local PostgreSQL and include populated schema-1 assessment/source/credential preservation plus historical corrections. REST tests exercise real local PostgREST role/RLS boundaries, bad metadata, unauthorized/self review, valid-column modification denial, actual reviewer attribution, separate issuance/category checks, consent/filter privacy, immutable source/correction behavior and revocation. The six new browser cases run on desktop/mobile, including 320px, with explicit offline fixtures.

Hosted users, physical wallets, actual Solana finalization and real institutional assessment quality are not proved by these fixtures. No production records, migrations or environment values were changed. Workspace-local logs are `/tmp/assessment-{unit,db,rest,browser,lint,types,format-check,build}.log`; they are not hosted acceptance evidence.
