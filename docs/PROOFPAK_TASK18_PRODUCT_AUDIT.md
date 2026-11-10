# ProofPak Task 18 — Product experience audit

**Date:** 9 November 2026. **Repository:** `robinwiz006-creator/PakProof`.

**Inspected checkout:** branch `task-17-release-readiness`, commit `17b3dc8`, based on merged application commit `00fa9830e3444f35e8ed6a323fc2933a2d0e9970`. This is the actual current workspace, rather than an assumed return to an older feature branch. Tasks 14–16 are present in its history (`f62941e`, `a09ad3a`, `50efc3a`). Existing uncommitted Task 17 work is preserved. Only the two Task 18 documents are added by this task.

## Executive summary

ProofPak already has substantial connected functionality. A person can build a professional Passport without a wallet or challenge. Organizations can review practical work, issue a separate credential under category permissions, and let the recipient decide what to accept and publish. Employers can search opted-in Passports, keep private shortlists and continue accepted contact through a limited private exchange. Paid projects have offers, agreed milestones, reviews, devnet payments, recovery and optional work history.

**The product does not need another platform rebuild or another broad visual redesign.** Its next gains should come from preserving a user's intention across screens, making pending actions visible, distinguishing missing records from load failures, and simplifying organization setup.

The largest delivery constraint is still the difference between implemented code and hosted capability. The founder confirms that the live database has the original nine migrations, but not the ten newer migrations or the permission cleanup patch. Those facts are treated as the supplied production baseline, not newly verified hosted results. Newer workflows must not be presented as production-ready. Migration and backup work remain paused; this audit neither resumes nor approves them.

### Five most important product problems

1. **Hosted capability does not match the current source.** Several core screens require newer views/functions even when their basic data tables already exist. A user can encounter an unavailable section or a failed page rather than a working end-to-end journey.
2. **Opportunity intent is lost during authentication.** Paid-project login has no return destination; the safe-return helper only accepts challenge paths; failed login and account creation can also drop the destination.
3. **Important updates require hunting across screens.** Home presents good starting actions, but pending credentials, incoming contact, offers and review work are not one prioritized next-action list. There is no general notification/delivery system.
4. **Some missing data is actually a hidden loading failure.** Passport credential and completed-work sections return nothing on query errors. People cannot tell whether their record is empty or temporarily unavailable.
5. **Organization setup exposes several overlapping concepts.** Company profile, organization registration, institutional trust, category authorization and wallet purpose are distinct and justified internally, but the interface leaves users to assemble the process.

**Recommended next development task:** preserve the selected opportunity through sign-in, failed-login retry and new-account confirmation. Reuse existing safe-return validation and Auth flows. No live database change is needed. See the companion roadmap for scope and acceptance criteria.

## 1. Scope, evidence and limits

This is a product/source audit, not a new database or backup audit. No hosted API probing, production login, backup, restore, SQL execution, migration, deployment, wallet connection or transaction was performed. No application code or settings were changed. The friend's hosted testing was not used or interrupted. First-time-user judgments below are source/UI-based findings, not a newly conducted usability study or proof of the five-second goal.

Sources include actual routes, components, server actions, SQL permissions/workflow definitions, unit tests, browser fixtures and earlier reports. Earlier reports are historical evidence, not substitutes for the current source. In particular, older reports describing missing credential correction or accepted-contact dead ends are outdated: both now have implementations.

Evidence terms:

| Status                                                 | Meaning in this report                                                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Working and tested                                     | Named local automated behavior passed; never implies hosted or physical-wallet success                              |
| Implemented but partially tested                       | End-to-end code exists, but live accounts, integration details or devices remain unverified                         |
| Implemented but blocked by pending database migrations | Source depends on one of the ten unapplied migrations; local testing may still pass with fixtures/full local schema |
| Partially implemented                                  | A useful subset exists; stated remaining behavior is absent                                                         |
| Missing                                                | No implemented route/model/action was found for the stated capability                                               |
| Unclear and requiring verification                     | Source alone cannot establish the configuration or real outcome                                                     |

Where a row has both a local status and a hosted caveat, both matter. “Blocked” describes the source/schema combination, not a claim that a particular deployed page was observed failing.

## 2. Current architecture and product identity

Next.js App Router uses server-rendered routes, Server Actions and API handlers. Supabase supplies email/password Auth, PostgreSQL data, RLS and workflow functions. Wallet Standard supplies supported wallet message and transaction signing. Solana provides Memo integrity records and devnet SPL-token transfers. The payment/proof server independently checks blockchain evidence before recording success.

Relevant files: `package.json`; `src/lib/supabase/server.ts`; `src/proxy.ts`; `src/lib/actions.ts`; `src/lib/credential-actions.ts`; `src/lib/paid-actions.ts`; `src/app/api/{wallets,proofs,credential-proofs,payments}/route.ts`.

Installed package declarations include Next.js 16.4.5, React 19.3.0, Supabase JS 2.117.3 and TypeScript. The Solana stack includes the compatibility wrapper, kit and legacy serialization package. These are implementation details, not concepts users should have to understand to publish a profile.

The current identity is **a professional record with optional ways to build evidence and find work**. It already fits all four pillars. Challenges are unpaid assessments; paid projects are one-worker, agreed-scope work; credentials are separately authorized organizational statements. None should replace the Passport as the home of the person's record.

## 3. Feature-status matrix

Test names below are repository evidence. Current-run totals and the limits of fixture tests are in section 10.

| Capability and route                                | Actual implementation                                                                                                      | Status and hosted qualification                                                                                   | Evidence                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Homepage and explanation, `/`, `/how-it-works`      | Passport-first marketing, illustrative preview, real opportunity loader, trust/devnet disclosures                          | Working and tested locally; current hosted content not inspected                                                  | `src/app/page.tsx`; `src/app/how-it-works/page.tsx`; `tests/e2e/marketing.spec.ts`                                            |
| Signup/login, `/sign-up`, `/sign-in`                | One account; preferred starting workspace; Supabase password login and email callback                                      | Implemented but partially tested; real email/session/configuration not verified here                              | `src/lib/actions.ts` `signUp`, `signIn`; `src/app/auth/callback/route.ts`                                                     |
| Recovery and confirmation                           | Reset password and resend confirmation; neutral reset response                                                             | Implemented but partially tested; SMTP and real callback delivery require hosted tests                            | `src/components/recovery-form.tsx`; recovery actions; `/forgot-password`, `/reset-password`, `/resend-confirmation`           |
| Personal Home, `/portal/talent`                     | Three starting actions, visibility, skills/project counts                                                                  | Working and tested locally; not an actionable combined inbox                                                      | `src/app/portal/[...section]/page.tsx`; `tests/e2e/dashboard-journeys.spec.ts`                                                |
| Guided profile                                      | About → skills → projects → preview/publish; optional fields can be skipped                                                | Working and tested locally; real save/publication not hosted-verified                                             | `src/lib/profile-setup.ts`; `src/components/profile-setup-form.tsx`; `tests/profile-setup.test.ts`                            |
| Education and ordinary employment history           | One university/institution text field; bio; separate paid-work history                                                     | Partially implemented; no repeatable education or employment records                                              | `src/lib/types.ts` `Profile`; profile step whitelist; `PassportView`                                                          |
| Photo and document upload                           | Initials avatar; URLs for evidence                                                                                         | Missing as a managed upload workflow; don't describe initials as uploaded photos                                  | `src/components/passport-view.tsx`; `src/components/project-editor.tsx`; no application Storage calls found                   |
| Projects and skills                                 | Add/edit/delete with confirmation; skills; GitHub/demo/evidence URLs                                                       | Working and tested locally; project visibility follows Passport rather than a per-project privacy switch          | `saveProject`, `removeProject` in `src/lib/actions.ts`; `project-editor.tsx`; `tests/passport.test.ts`                        |
| Public Passport and sharing, `/talent/[slug]`       | Public-profile gate, projects, achievements, credentials, completed work; copy link                                        | Implemented but partially tested; newer credential reads can fail invisibly on legacy schema                      | `src/lib/data.ts` `publicPassport`; `passport-view.tsx`; `passport-actions.tsx`                                               |
| Directory/contact consent                           | Separate public, discoverable and allow-contact preferences                                                                | Implemented but blocked by pending database migrations                                                            | `discovery-settings.tsx`; `set_discovery_preferences`; migration `202611050004`                                               |
| Organization registration, `/organizations`         | Register type, reuse owned company or create company; member-only management workspace                                     | Base exists; full current workspace blocked by newer trust/provenance dependencies                                | `registerOrganization`; `register_organization`; `src/app/organizations/page.tsx`                                             |
| Institutional trust review                          | Self-registered, Verified Organization, Trusted Assessment Partner; private evidence and admin decision                    | Implemented but blocked by pending database migrations                                                            | `organization-trust.ts`; `organization-verification-workspace.tsx`; migration `202611070002`; organization-verification tests |
| Issuer category authorization                       | Explicit categories, independent administrator, staff attribution, decision history                                        | Implemented but blocked by pending database migrations; no automatic broad permissions                            | `issuer-permissions.ts`; `/issuer-admin/[id]`; migration `202611050002`; issuer-trust tests                                   |
| Direct credential issuance                          | Existing public recipient slug/full URL; private issuance pending recipient decision                                       | Base issuance exists; current permission/provenance model blocked pending migrations                              | `issueCredential`; `recipientPassportSlug` in `credentials.ts`; `issuer-type-fields.tsx`                                      |
| Invitations to people without an account            | No safe email invite/claim journey exists                                                                                  | Missing; public Passport lookup is not an invitation system                                                       | Issuance form explicitly says existing public recipient and no email search                                                   |
| Credential inbox, `/my-credentials`                 | Accept/decline, publish separately, share evidence separately                                                              | Implemented but blocked by current select's newer relations; consent UI locally tested                            | `credential-inbox-item.tsx`; `respondCredential`; `credentialSelect`                                                          |
| Qualification review                                | Private evidence URL request to authorized university with degree permission; institutional review                         | Implemented but partially tested; current allowed-category query requires pending schema                          | `requestQualification`, `reviewQualification`; `/my-credentials`; `/organizations?view=requests`                              |
| Credential public verification, `/credentials/[id]` | Certificate, lifecycle, current trust, issuance provenance, assessment, live proof check, copy link                        | Implemented but blocked by newer public/context/lineage dependencies                                              | `credential-detail.tsx`; `credential-lifecycle.ts`; `credential-verification.ts`; lifecycle/presentation tests                |
| Correction and revocation                           | New replacement, immutable original, new consent, controlled supersession, private audit/safe public history               | Implemented but blocked by pending migrations                                                                     | `credential-correction.tsx`; migrations `202611060001`, `202611060002`; correction/revocation tests                           |
| Challenges, `/challenges/[id]`                      | Published brief, deadline, evidence submission and review/revisions                                                        | Base exists; current criteria/review paths blocked by assessment migrations                                       | `submitWork`, `reviewSubmission`; `challenge_public_rubrics`; challenge-assessment tests                                      |
| Structured assessment                               | Versioned criteria, outcomes; optional method/competencies/result/date/score; immutable review snapshot                    | Implemented but blocked by pending migrations; primarily challenge-review based                                   | `assessment-details.ts`; `challenge-assessment.tsx`; migrations `202611050003`, `202611070003`                                |
| Challenge achievement → credential                  | Approval produces achievement; separate permitted issuance from reviewed work                                              | Implemented but blocked by pending migrations; not automatic credential creation                                  | `issue_challenge_credential`; “Issue credential for this work” in portal reviews                                              |
| Achievement verification, `/verify/[id]`            | v1/v2 records, approved evidence where shared, live devnet integrity check                                                 | Implemented but partially tested; legacy proof fixtures pass, physical wallets not tested here                    | `src/app/verify/[id]/page.tsx`; `proof.ts`; `tests/proof.test.ts`                                                             |
| Opportunity discovery, `/opportunities`             | Real published challenges/projects; search/type filter; useful empty/partial-failure states                                | Working and tested locally; paid projection absent in supplied hosted baseline                                    | `live-opportunities.ts`; `opportunity-browser.tsx`; live-opportunities/opportunity-ux tests                                   |
| Bounties, prizes, jobs                              | No dedicated prize fields, bounty award/settlement or job-posting workflow                                                 | Missing; current challenges are explicitly unpaid                                                                 | `Challenge` type; opportunity kinds limited to challenge/project; no bounty route/model found                                 |
| Employer search, `/portal/company/directory`        | Server-side search/pagination; public skills/projects; published credential/assessment filters                             | Implemented but blocked by pending migrations                                                                     | `employer-directory.tsx`; `search_passports`; migration `202611050004`; employer-discovery tests                              |
| Private shortlists                                  | Organization-only save/remove/note; respects later privacy withdrawal                                                      | Implemented but blocked by pending migrations                                                                     | `candidate-card.tsx`; `saveCandidate`; employer-discovery SQL/REST tests                                                      |
| Consent-based contact                               | Request/accept/decline; accepted private handoff; six notes per side; close/withdraw; linked opportunity                   | Implemented but blocked by pending migrations; not a full chat or automatic application                           | `/contact-requests/[id]`; `contact-handoff.tsx`; migration `202611070001`; contact-handoff tests                              |
| Paid project/offer/agreement                        | Draft creation, one worker, application, selection, offer acceptance, immutable accepted terms                             | Implemented but partially tested locally; public discovery now requires pending privacy view                      | `paid-actions.ts`; `/paid-projects/[id]`; migrations `202610120005`–`008`; payment/paid-lifecycle tests                       |
| Draft editing/cancellation                          | Controlled draft correction, withdrawal, pre-agreement cancel, explicit post-agreement process                             | Implemented but blocked by pending lifecycle migration                                                            | `edit_paid_project`, `change_paid_lifecycle`; migration `202611050005`                                                        |
| Milestone evidence and review                       | Submit, revise, approve; approval distinct from payment                                                                    | Implemented but partially tested; full current management also queries pending lifecycle tables                   | Paid detail route; `submitPaidMilestone`, `reviewPaidMilestone`                                                               |
| Wallet ownership, `/wallet`                         | Phantom/Solflare supported provider, nonce message, server verification, purpose separation, guarded unlink                | Implemented but partially tested; physical extension/mobile signing unverified                                    | `wallet-manager.tsx`; `/api/wallets`; `wallet-ownership.ts`; wallet tests                                                     |
| Test-USDC payments and receipts                     | Real transfer preparation/signing/broadcast; server finalized settlement verification; duplicate guards                    | Implemented but partially tested; devnet-only, fixture-based transaction tests, no real payment demonstrated here | `payment-chain.ts`; `payment-server.ts`; `/api/payments`; payment-chain tests                                                 |
| Payment/proof recovery                              | Save original signed bytes/signature, reconcile same attempt, distinguish unknown outcome; protected unsigned cancellation | Implemented but partially tested; browser/device/RPC recovery needs live validation                               | `transaction-recovery.ts`; anchor/payment components; transaction-recovery tests                                              |
| Completed paid work                                 | All required completion conditions; worker publication and company disclosure consent; separate evidence choice            | Implemented but partially tested; source has rendering/error gaps                                                 | `PassportPaidWork`; `sharePaidWork`, `consentPaidWork`; migration `202610120007`                                              |
| Notifications, support and moderation               | Inline feedback, status lists and issuer audit history only                                                                | Partially implemented as feedback; missing general notifications, report/appeal/support/moderation queue          | Action messages; Auth email only; existing API/admin route inventory                                                          |
| Refunds and escrow                                  | No escrow or refund execution                                                                                              | Missing by design; cancellation does not reverse a settled transfer                                               | Paid detail disclosure; lifecycle/payment functions                                                                           |

## 4. Journey A — Student or professional

### What works in the design

1. Homepage describes the Passport before optional work. “Build Your Passport” and “Explore Opportunities” are clear choices. Illustrative marketing records are distinct from real listings.
2. Signup explains that one account serves personal and organization workspaces. The starting-role choice is a preference, not authorization.
3. Home offers profile, opportunities and credentials. Profile steps separate editing from viewing and allow optional information to be skipped.
4. Projects have title, description, skills and evidence. Editing uses the existing record ID; deletion is confirmed. A user does not need a challenge to create useful work evidence.
5. Preview/publication are explicit. Publishing the Passport does not automatically consent to private credential evidence or paid-work disclosure.
6. Credentials arrive in the existing inbox. The recipient accepts or declines and independently chooses publication/evidence sharing.
7. Challenge feedback and achievements live under My Activity; paid applications/offers link to paid-work management. Public sharing uses the existing slug URL.

Evidence: `src/app/portal/[...section]/page.tsx`; `src/lib/profile-setup.ts`; `src/components/{project-editor,passport-actions,credential-inbox-item}.tsx`; `src/lib/actions.ts`; `tests/e2e/dashboard-journeys.spec.ts`.

### Friction and missing connections

- **Application loses context:** paid-project visitor → `/sign-in` → preferred dashboard, rather than original project. `safeReturnPath` accepts only challenge URLs. Even a supported challenge destination is lost after a failed-login redirect or choosing signup. This is confirmed from link/action/helper code, not a hosted reproduction.
- **Home never becomes a truly personal next-step screen.** It has useful static action links, but its profile summary is limited to skills/projects; pending credential decisions, offers and contact requests require separate visits. Do not replace it with another decorative card grid: add a short, state-driven priority list.
- **Professional record is incomplete beyond projects.** A university name and bio are not structured education or employment history. Completed paid work is a separate valuable capability but does not cover internships or prior jobs outside ProofPak.
- **Publication scope needs careful explanation.** Ordinary portfolio projects follow Passport-level visibility. There is no per-project private switch. A private Passport also suppresses public credentials; credential publication alone is insufficient. Directory discovery and contact are two further preferences.
- **Profile changes are not safely navigated by default.** Setup explicitly asks users to save before moving; there is no dirty-form confirmation in `ProfileSetupForm`. The project form preserves invalid submitted values, but navigating away can still discard an unfinished draft.
- **Silently missing credentials/work history:** both Passport section loaders return `null` on query errors. Credentials and paid work are also loaded sequentially in `PassportView`, despite being independent. Failure reporting and parallel loading are more useful than another layout redesign.
- **Private does not mean no authorized review access.** The initial `profiles_read` policy permits company reviewers to read a submitted candidate’s profile through `can_review_profile`. Foundation migration removes this exception from ordinary projects, not the profile policy. Public Passport routing still requires `is_public`. Explain this distinction before submission; do not describe the entire private account as visible only to its owner. This is a wording/consent clarity finding, not a new claim of anonymous exposure.
- **A shared link can change:** publication permits slug changes and warns to keep it unchanged. No previous-slug redirect registry exists.

### End-to-end evidence needed

A reserved candidate must register, receive real confirmation, save a project, publish and open their Passport in an anonymous browser; then receive/accept a credential, apply to work and reach the original opportunity after login. Existing browser setup tests explicitly operate in a read-only demo and cannot publish real records. Do not call them hosted onboarding tests.

## 5. Journey B — University, bootcamp or credential issuer

### Existing connected workflow

Register organization (or attach the general organization record to an owned company) → submit institutional verification links → independent administrator reviews institutional trust → separately approve permitted credential categories → issue credential → recipient accepts/chooses publication → optional issuer-wallet Memo anchor → anonymous public verification.

A university degree requires the existing university/type/category rules and an authorized human review; an uploaded URL is not proof. A hypothetical Superteam Pakistan hackathon award uses the same organization/category/recipient flow. No real institutional authorization or award is assumed.

`register_organization` in `202610120002_organizations_credentials.sql` explicitly supports reusing an owned company; there is no need to build a second organization system. `202611050002_issuer_trust.sql` adds category constraints and private representative attribution. `202611070002_organization_verification.sql` adds independent trust review. These are separate controls:

| Question                                      | Existing answer                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| Does an organization account exist?           | Registration/company membership                                              |
| Has its institutional identity been reviewed? | Current institutional trust level and possible suspension                    |
| May it issue this category?                   | Current issuer status plus explicitly approved credential types              |
| Who issued this record under what authority?  | Issuance provenance and private representative audit                         |
| Has the recipient agreed to display it?       | Acceptance, credential publication, Passport visibility and evidence consent |
| Is the credential currently active?           | Revocation, supersession, explicit dates and acceptance                      |
| Does the historical commitment match Solana?  | Independent finalized Memo integrity check                                   |

### Lifecycle is already implemented

`correctCredential`/`correct_credential` create a new replacement rather than editing original facts. New consent is required. Acceptance supersedes the original under the controlled lifecycle; declining a proposal does not supersede it. A revoked original remains historically revoked. Private replacement details are not automatically public. `credentialLifecycle`, correction notices and safe public event/context/lineage projections preserve these distinctions. Old v1/v2/v3 hashes are not rewritten.

### Genuine gaps

- First-time issuers see registration, verification requests, category approval and “Issue credential” across several views. A compact checklist should say what is missing and what action follows; a new approval system is unnecessary.
- Direct issuance requires an existing public Passport; challenge-linked issuance derives the recipient from approved work and supports a private recipient. This difference is intentional privacy protection but needs plain explanation. Email invitations/bulk import are not implemented.
- Rich structured assessment details are captured from challenge reviews. Direct course/workshop/degree issuance is not a universal assessment authoring system. Do not infer methods/scores for those records.
- The recipient controls disclosure, but source evidence URLs have their own permissions and may expire. ProofPak stores references/digests, not a guaranteed archive of the evidence content.
- Public issuer identity is shown inside credentials with an official website where supplied. There is no standalone public institutional profile route; `/organizations` is private management, not an organization directory.
- No formal dispute/appeal intake or service-level process exists. Issuer correction/revocation and private admin audit do not replace dispute handling.
- Membership-management UI is explicitly deferred. Real institutions will need safe staff onboarding/offboarding, but that should follow a working pilot, not precede core-flow testing.

Evidence: organization/admin routes; `credential-actions.ts`; `credential-record.tsx`; `credential-detail.tsx`; `organization-trust.tsx`; correction, lifecycle, issuer-trust and assessment-transparency tests.

## 6. Journey C — Employer or organization

### Existing value beyond a job board

An employer can inspect projects and consented evidence, distinguish organizational credentials from self-added claims, search explicitly discoverable Passports, privately save candidates, ask for contact and discuss next steps after acceptance. Challenges let organizations observe practical work. Paid projects carry agreed delivery and receipts into a professional record when both disclosure controls permit it.

Search is performed by the database with pagination; the UI says skill matching is exact and ordering is alphabetical, not an unsupported quality ranking. Published credentials can be expired/revoked; the directory warns to inspect their status. No hidden private-credential counts or automatic contact information are intended.

`EmployerDirectory` → `search_passports`; `CandidateCard` → `save_candidate`/`create_contact_request`; `/contact-requests/[id]` → `visible_contact_followups`, `contact_request_opportunity`, `send_contact_followup`, `close_contact_request`.

Accepted contact is **no longer a dead end**. Each side gets up to six short notes; candidate closure and organization withdrawal stop further notes. A linked opportunity must belong to the organization and be available for the relevant action. Contact acceptance creates no application, agreement or payment.

### Friction

- Find candidates is placed in the organization's secondary navigation, although it is a principal employer benefit. Consider promoting it based on workspace role without increasing the primary menu for all users.
- Exact skill input and a broad “has published credentials” filter are useful but limited. They are not semantic matching or a current-category-specific qualification filter. Do not advertise AI ranking or job matching.
- The combined opportunities screen loads at most 100 recent open rows per type and filters them in the browser. Older still-open relevant work can be omitted. Employer candidate discovery already has server pagination; reuse its pattern rather than changing privacy boundaries.
- `/opportunities`, `/challenges`, `/portal/talent/browse` and `/paid-projects` overlap. Specialized work-management routes are useful; redundant public discovery paths need consistent labels and filters, not wholesale deletion.
- Organization context is not consistently carried in navigation. Several areas aggregate memberships, others use a selected/default organization; `PortalNav` preserves role, not a universal company selection. With two organizations, users can land in a different default context. Backend permissions remain necessary regardless of UI context.
- Review and milestone pages expose many operations together. Show the next allowed action from actual state; keep full history secondary. Do not collapse approval and payment into one status.
- No applicant pipeline/shortlisting for paid-project applications beyond the existing selection flow was found. Candidate-directory shortlists are a different implemented capability.

### Paid work sequence and limits

Create draft → define scope/budget/milestones → publish → application → select worker/offer → worker accepts locked terms → payout wallet authorization → submit milestone → revision or approval → payer prepares exact transfer → wallet signs → register signed bytes → broadcast → finalized independent settlement → receipt → completed-work disclosure choices.

Draft editing, controlled withdrawal and post-agreement cancellation already exist. Unknown or paid transactions cannot be treated as simply cancelled. Recovery retains original signatures and signed bytes; it does not create an automatic second payment. Worker publication, company disclosure and evidence sharing remain separate. Payment is not a credential and completion does not certify a skill.

No guaranteed payment, escrow, mainnet revenue, refund execution or formal dispute resolution is implemented. A company can still fail to pay after approval. Devnet transfers are a real technical integration, not real earnings.

## 7. Journey D — Platform administrator

| Administrator need         | Actual capability                                                                 | Gap/manual responsibility                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Review issuers             | `/issuer-admin`: counts/search/status filters and per-organization review         | Human review standards and response times are operational, not automated identity checks                    |
| Institutional verification | Private evidence requests; approve/reject/suspend/downgrade; independent reviewer | Cannot approve an organization the administrator belongs to; need another admin                             |
| Category permission        | Explicit category selection, suspension/reinstatement/history, private reasons    | Conservative authorization and academic authority review must be performed by people                        |
| Credential accountability  | Issuance representative, immutable assessment and correction/revocation audit     | Issuer-facing correction is implemented; no general administrator dispute console                           |
| Abuse/moderation           | Existing role/permission checks and issuer suspension                             | No report-content queue, candidate block/report UI, general account/content moderation console found        |
| Contact spam               | Database limits, duplicate controls, consent and closure                          | No centralized abuse triage dashboard or candidate-specific organization blocking interface                 |
| Payments/proofs            | Protected reconciliation endpoint and party recovery UI; immutable receipts       | No general operator incident console or “mark paid” control; unknown outcomes require careful investigation |
| Platform administration    | `platform_administrators` and `is_platform_administrator`                         | Initial administrator/staff provisioning has no general UI; needs separately controlled operator action     |
| Support                    | Inline error messages and technical history                                       | No implemented support-ticket intake, assignments, escalation or notification delivery                      |

Do not give administrators raw production SQL as a normal product interface. A future support surface should use narrowly authorized, audited actions. It must not bypass settlement verification or reveal private institutional evidence.

Evidence: `/issuer-admin`, `/issuer-admin/[id]`; `organization-trust-actions.ts`; authorization/trust migrations; `/api/payments/reconcile/route.ts`; route inventory. The reconciliation endpoint can write results; it was not invoked as a “status check.”

## 8. UX evaluation across main workflows

| Workflow             | First action / next action                                      | Feedback, empty and error handling                                                                                              | Mobile and practical assessment                                                           |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Homepage/discovery   | Clear Passport and opportunity actions                          | Real listings, empty/partial-unavailable states; no fabricated fallback listings                                                | Responsive fixture checks exist; no need to redesign homepage                             |
| Signup/login         | Short form; preferred workspace explained                       | Generic failure and confirmation instructions; retry loses destination/context                                                  | Accessible fields; real delivery/browser session still unverified                         |
| Profile setup        | Four short, skippable stages                                    | Action-state validation preserves bad submitted inputs; save-before-moving warning                                              | Existing 320/390px tests; dirty navigation needs protection                               |
| Passport viewing     | Professional sections and share link                            | Base load failure surfaces; credentials/work errors disappear silently                                                          | Existing responsive layouts; test missing-section cases explicitly                        |
| Credential decisions | View Credential is clear; settings are expandable               | Consent accurate but decisions/publication/evidence settings are nested together                                                | Locally fixture-tested; first-time recipient task visibility can improve                  |
| Issuer setup         | Many useful routes, insufficient unified sequence               | Category and identity decisions separate; large overview can become long with several organizations                             | Group by organization/context, progressive disclosure; no new approval model              |
| Challenge review     | Rubric and explicit review decision                             | Achievement success message and separate credential action already exist                                                        | Review forms can be long; preserve required criteria and snapshot controls                |
| Paid work            | Public Apply dialog is focused; party view becomes dense        | Work/payment states distinct; unknown outcome guidance exists; some query errors can resemble empty company/application results | Existing compact styles and dialog tests; real signing/recovery not tested by screenshots |
| Employer/contact     | Search → Passport → shortlist/contact → private handoff         | Privacy gates, empty states, quota and closure guidance implemented                                                             | Good bounded scope; no full-chat rebuild needed                                           |
| Administration       | Search/review panel and confirmations                           | Private reasons/history exist                                                                                                   | Local fixture tests support layout, not actual institutional review quality               |
| Wallet               | Purpose then selected Phantom/Solflare, connect, sign ownership | No unsupported QR; missing extension, rejection and server confirmation handled                                                 | Supported in-app provider only; no desktop-to-phone QR claim                              |

Examples of wording to tighten: `ApprovedEvidence` says company identities are self-registered even when a related general organization might have current institutional trust; company/profile labels coexist with organization labels; My Passport/My Profile remain in secondary administration links. Preserve distinctions, but use one everyday term per action. Do not replace trust facts with a blanket “Verified” badge.

## 9. Solana assessment in simple English

### What actually uses it

| Use                     | Signed/submitted action                                                                                             | What stays in Supabase                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Wallet ownership        | Sign a nonce-based message, **no transaction**                                                                      | Account/org/purpose link, challenge and confirmation                                                           |
| Challenge achievement   | Wallet signs Memo transaction containing v1/v2 claim hash                                                           | Approved facts, evidence snapshot, sharing choices and recorded signature                                      |
| Organization credential | Authorized issuer wallet signs `proofpak:v3:<hash>` Memo transaction                                                | Credential facts, authorization, private representative, consent, revocation/correction and assessment context |
| Milestone payment       | Authorized payer signs real SPL `TransferChecked` plus intent-bound Memo and destination account creation if needed | Agreed terms, approval, intent, signed attempt, strict verification result and receipt                         |

`proof.ts`, `credential-proof.ts`, `credential-solana.ts`, `solana.ts`, `payment-chain.ts`, `payment-server.ts` and `transaction-recovery.ts` are the main implementation evidence.

The devnet test mint is `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, with six decimal places and the configured classic token program. The server checks the devnet genesis hash and actual mint/account layout rather than trusting frontend selection. No live mint/RPC check was made in Task 18.

### Proof verification

The server reconstructs the versioned claim hash, checks evidence/context commitments where available and looks for the expected signed Memo in a successful **finalized** devnet transaction. A stored signature is insufficient. Old v1 claims protect fewer fields; v2 adds fuller achievement facts/evidence commitment; v3 protects general credential facts and authorization reference. Historical formats are preserved.

A matching proof answers **“does this historical commitment match?”** It does not answer **“is the skill true, is the issuer accredited, has the credential since been revoked, or does the recipient consent to publication?”** Those separate current checks remain in the application/database. Public visitors need neither an account nor a wallet for an eligible shared credential.

### Payment verification and recovery

The application uses integer token units. Backend checks include network, mint/program/decimals, payer signer, token-account ownership, exact approved amount, intent Memo, registered signed bytes, finalization and successful transaction metadata/balance changes. Uniqueness and locked workflow functions prevent one receipt from satisfying multiple obligations. Pending/unknown/review states cannot be casually converted to Paid.

Original signed attempts/signatures are retained before broadcast where possible. Recovery reuses the original transaction or reconciles the same signature. A failed database save after chain success must not cause repayment. Browser-storage loss, wallet behavior and archival RPC availability remain meaningful limitations even with local tests.

### Meaning and limitations

This is **implemented real transaction functionality on devnet**, not a fake success animation, but a fresh real-device transfer has not been demonstrated by this audit. Test tokens have no monetary value. Mainnet, escrow and guaranteed payment are absent. Wallets are needed for signing proofs/payments and for proving payout-wallet ownership; they are unnecessary for signup, profile creation, most discovery, credential receipt and public viewing.

ProofPak's server still controls permission checks, claim reconstruction, RPC validation and recording. Supabase holds current consent, trust and lifecycle state. A visitor is not independently running a downloadable verifier today. A future portable verification package may help portability; another smart contract is not needed to fix today's user-journey gaps.

## 10. Validation and security boundaries

### Fresh Task 18 checks

- `npm test`: **105 passed, 0 failed, 0 skipped**. Includes historical proof hashes, payment settlement fixtures, wallet ownership, profile, assessment, correction, lifecycle, contact and navigation helpers.
- `npm run lint`: passed (exit 0).
- `npm run typecheck`: passed (exit 0).
- Browser results and its production-build result are recorded in the final validation note below.
- Database and REST mutation/fixture harnesses were **not run in Task 18**: the task prohibits applying SQL migrations and is not another database rehearsal. Their source and previous results were reviewed, not reported as fresh passes. No backup/restore helpers were run.

The browser harness (`playwright.config.ts`) explicitly blanks hosted Supabase and server credentials, enables labeled local fixtures and tests desktop/mobile Chromium. Passing an Apply fixture validates UI/field contracts, not a saved hosted application. Passing a wallet fixture is not real Phantom/Solflare signing. Prior Task 17D reports **19 database suites, 80 REST checks and a populated synthetic upgrade rehearsal**, but those remain historical local evidence, not Task 18 results or hosted verification.

### Security observations relevant to the product

- Current source has database-enforced issuer categories, independent trust decisions, recipient consent, privacy-safe public paid/event/context views, private contact channels and strict receipt checks. Their migrations remain essential; rendering fewer fields is not a substitute.
- The supplied legacy hosted baseline does not contain newer privacy fixes. Do not claim its actual REST exposure was reproduced in this task or that current code alone repairs hosted grants.
- Existing authentication/RLS checks must remain in every next task. Organization membership, issuer category authorization, institutional trust and wallet purpose must not be conflated.
- `docs/DEPENDENCY-SECURITY-REVIEW.md` and Task 17 record remaining wallet/Solana transitive advisories. No fresh npm security audit was performed for this product audit; previous advisory counts must not be described as current. Dependency exposure review remains a release concern, separate from frontend workflow improvements.
- Error reporting should avoid raw SQL/PII. Current action messages are generally safe, but generic failures can obscure a useful next action. Introduce actionable messages without weakening authorization or showing private records.
- This review is not an independent security audit.

## 11. Database-aware product readiness, without resuming migration work

The repository has 19 application migrations plus the prepared `202611090001_legacy_client_permissions.sql` patch. The ten unapplied application migrations are, in order:

1. `202611050001_paid_project_public_privacy.sql`
2. `202611050002_issuer_trust.sql`
3. `202611050003_challenge_assessments.sql`
4. `202611050004_employer_discovery.sql`
5. `202611050005_paid_project_lifecycle.sql`
6. `202611060001_credential_revocation_privacy.sql`
7. `202611060002_credential_corrections.sql`
8. `202611070001_contact_handoff.sql`
9. `202611070002_organization_verification.sql`
10. `202611070003_assessment_transparency.sql`

This list explains product status; it is **not an execution instruction**. The existing Task 17 plans own migration safety and remain paused.

Concrete source/schema dependencies:

- `credentialSelect` embeds safe revocation events, provenance, assessment context and correction status; missing any can prevent the whole credential read. That affects the inbox, issued list, detail and Passport sections.
- Challenge detail loads `challenge_public_rubrics`; review calls `review_assessed_submission_details`. Existing challenge rows alone do not make those routes compatible.
- Employer search/contact requires newer functions, preferences and visible projections.
- Public paid discovery uses `public_paid_projects`; paid management also loads newer cancellation/history records. Old paid tables alone are insufficient for full current UI.
- `/wallet` uses base wallet tables, but organization context and later payment/issuer guards still need schema-compatible testing. Do not assume it is broken or confirmed working based on migration age alone.

Current serving Vercel SHA, real email behavior, real account journeys and real-device payments are **not verified in Task 18**. No recommendation to proceed with production is made.

## 12. What to keep, simplify and postpone

**Keep:** Passport-first home; one account; skippable setup; existing project editing; separate achievements/credentials; consent controls; organization reuse; private employer contact; immutable terms; finalized proof/payment verification; historical formats; supported wallet-specific connections.

**Simplify:** authentication return paths; next-action presentation; organization setup/context; duplicate discovery entry points; section-level failure feedback; long review/management screens through progressive disclosure; inconsistent trust wording.

**Do not rebuild:** issuer authorization, corrections, contact handoff, wallet ownership, draft/cancellation or signed-transaction recovery. They already exist.

**Postpone:** full chat/ATS, automatic skill rankings, teams/payment splitting, real-money mainnet, escrow, tokens/NFTs, complex bounty economics, sensitive-document uploads and mass credential issuance until core hosted journeys and operating responsibilities are proven.

The complete task-by-task priorities, implementation impact and acceptance criteria are in [the Task 18 development roadmap](PROOFPAK_TASK18_DEVELOPMENT_ROADMAP.md). No implementation is authorized by this audit.

## Final Task 18 validation note

| Check                                                           | Passed | Failed | Skipped / not run | Scope                                                                                                                             |
| --------------------------------------------------------------- | -----: | -----: | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests, `npm test`                                          |    105 |      0 | 0 skipped         | Fresh local offline suite                                                                                                         |
| Desktop/mobile browser tests, `npm run test:e2e -- --workers=1` |    204 |      0 | 0 skipped         | First full run, no retries; Chromium; responsive cases include 320/390px                                                          |
| Production build                                                | Exit 0 |      0 | —                 | Executed by browser harness with `PROOFPAK_E2E=1`, `.next-e2e` and hosted keys blank; not a production-configured deployment test |
| Lint                                                            | Exit 0 |      0 | —                 | Fresh local run                                                                                                                   |
| TypeScript                                                      | Exit 0 |      0 | —                 | Fresh local run                                                                                                                   |
| Task 18 Markdown formatting                                     | Passed |      0 | —                 | The two new reports only                                                                                                          |
| Database / REST security harnesses                              |      — |      — | Not run           | Source/history reviewed; no SQL/migration/rehearsal executed under this task                                                      |
| Hosted user/email/privacy tests                                 |      — |      — | Not run           | Friend's testing left untouched                                                                                                   |
| Physical-wallet / chain tests                                   |      — |      — | Not run           | No transaction, no live signing and no live mint/RPC validation                                                                   |

Evidence logs: `/tmp/task18-unit.log`, `/tmp/task18-lint.log`, `/tmp/task18-type.log`, `/tmp/task18-browser.log`. Browser screenshots are local fixture artifacts under ignored `test-results/`, not real-account or hosted evidence. No application changes, commits, push, deployment, backup or database operation were performed.

Key source anchors for follow-up: `src/lib/passport.ts:2` (challenge-only return allowlist); `src/lib/actions.ts:57` and `:97` (signup/login); `src/app/paid-projects/[id]/page.tsx:254` (login without return target); `src/components/passport-credentials.tsx:18` and `passport-paid-work.tsx:17` (silent query failure); `src/components/passport-view.tsx:102` (independent section reads); `src/lib/live-opportunities.ts:38` (bounded discovery fetch).
