# Task 25: Evidence-based talent discovery

Extends `/portal/company/directory`, existing `employer_shortlists`, `contact_requests`, contact inbox/handoff and discovery consent. No second candidate directory, messaging platform or opportunity type is introduced.

## Use

Organization dashboard → Find candidates. Combine name/headline/project search, up to ten comma-separated exact skills (all required), public education/employment keywords, public project keywords, current credential category, published assessment and approved-work filters. Sorting is alphabetical or transparent public-evidence matches. Twenty results per server-side page; filters persist across pages.

Cards separate self-reported skills/history/projects from organization-issued credentials and company-approved achievements. Counts use currently discoverable/public records only. Revoked, expired, future-dated or superseded credentials never satisfy current-credential filters. Current issuer trust and issuance status are shown separately, with no guarantee of skill or government accreditation. Assessment outcomes are shown only when the owner shared assessment summaries. Reviewer notes, raw evidence and private education/employment never enter the directory.

Save a candidate with a private note and optionally one of your opportunities; use Private shortlist and its opportunity filter. A saved entry contains references and a note, never a copied Passport. Opting out/publication changes immediately remove candidate content from company search, shortlists and contact views.

Expand **Invite to opportunity or request contact**, select an open opportunity, write a purpose, review and send. Existing general-contact requests are unchanged. New opportunity invitations use the same inbox and handoff, expire after at most 14 days (or the opportunity deadline), and allow one invitation per organization/candidate/opportunity. Limits remain ten per organization and sender per 24 hours, and twenty pending per candidate. Accept/decline is explicit. Accepting never creates an application, agreement or payment; follow the linked opportunity to apply/submit through existing workflows. Candidates can stop contact through existing closure/consent controls. Organizations can review accepted invitations through Needs your attention and filter sent/incoming requests by status.

## Migration/release

`202611100003_talent_evidence_matching.sql` follows Task 23 and requires the preceding history, issuer trust, assessment, correction and contact-handoff schema. It adds shortlist opportunity references, invitation expiry, scoped uniqueness/indexes and the advanced search RPC. The original search RPC delegates to the new implementation for compatibility; original general-contact creation rules remain intact. Existing contact rows are preserved with no inferred expiration. No claim/proof/payment format changes, dependencies or environment keys were added.

23 migrations now exist. Production migration/backup/deployment work remains paused; apply nothing remotely without a separately approved coordinated release. The local test scripts include the migration at its correct place. Availability/work interests and a distinct bounty type have no structured source in the current application and were not invented. Relevance is public count ordering, not an AI or skill-quality score. Large-scale search tuning may be needed after real workload measurement.

## Validation

See final delivery and updated development handover for recorded counts. SQL tests use isolated PostgreSQL, REST tests use isolated PostgREST with synthetic identities, and browser fixtures test real UI controls/transport rather than hosted account flows. Hosted RLS configuration, real accounts and delivery remain unverified. Invitations are in-app only; no email was sent or claimed. No production data, credentials or backup archives are included.

### Recorded local results

- 148 unit tests passed, 0 failed/skipped; lint, TypeScript and formatting passed.
- 83 isolated REST tests passed, including real PostgREST opportunity invitation creation, recipient acceptance, duplicate denial, no automatic challenge submission and opt-out privacy.
- Focused PostgreSQL suite passed all five SQL files (matching, existing employer discovery, contact handoff, credential invitations and corrections). Full database/migration-chain suite also passed, including populated legacy preservation.
- Browser rerun: 40 desktop/mobile tests passed, 0 failed/skipped, no automatic retries. Initial run passed 38/40; an exact-label selector failed to identify the Sort combobox and was corrected to its accessible role/name. UI assertions were retained.
- During focused development, a test referenced the wrong application column, a REST denial test supplied an invalid body shape, and a disposable database readiness probe raced initial startup. Corrected the fixtures/probe and reran the affected suites. The full database legacy snapshot now compares every original field and additionally asserts no expiration was backfilled, rather than hashing the newly added null field as if it had existed before.

Assessed matching uses immutable approved achievement titles, not mutable hidden challenge fields. The ordinary production build result and final commit are reported in delivery. Hosted testing remains unverified and blocked by pending release work.
