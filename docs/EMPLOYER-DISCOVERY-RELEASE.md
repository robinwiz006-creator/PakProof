# Employer discovery, private shortlists and contact requests

## Scope and prior functionality reused

Task 6 builds on `90935a2` on `fix-wallet-specific-connection`. The former company directory selected the newest 100 public profiles, with no separate listing consent, server search or paging. Profiles already had skills, portfolio projects, public URLs and publication controls; credentials had recipient acceptance/publication; reviewed challenges had achievements, optional structured assessments and private evidence. Company owner/reviewer memberships already existed. There was no shortlist, product notification inbox or contact-request system.

This task reuses those records, public Passport/detail routes, company selection, authentication, shared form/status components and navigation. It does not build recruiting pipelines, matching, chat, email delivery, bounties, a marketplace or new blockchain functionality.

## New individual choices

Account Settings (`/portal/talent/settings`) now separates:

1. **Passport visibility**, using the existing publish/private page. A public link remains useful without employer discovery.
2. **Include my published Passport in the employer directory**.
3. **Allow organization contact requests in ProofPak**.

New directory/contact flags default to **false for every existing and new profile**. Credentials, achievements, prior public status, company membership and wallet links do not turn them on. Contact requires all three conditions: public Passport, directory opt-in and contact opt-in. Making a Passport private makes both features inactive; saved preferences remain and take effect again if the owner republishes. The owner can instead explicitly opt out before republishing.

In My Achievements, the owner may separately enable **Allow this achievement’s assessed-work summary in employer discovery**. This defaults false. Only an actual structured approved review qualifies; a legacy/unstructured approval does not become assessed merely because its owner checks the setting. It permits a summary label/title, not private outcomes, notes or evidence. Existing evidence sharing remains a separate setting. The directory’s assessed-work filter deliberately uses this explicit summary permission; it is not automatically inferred from receiving a credential.

**Publication boundary:** directory opt-out is not a promise that a public URL cannot be found, indexed or queried through existing public-record permissions. Public Passport/credential/project content remains public under its existing rules. Make the Passport private to restrict public content. Existing legitimate company access to work a person submitted for review also remains; this is not revoked by directory opt-out. All new directory, shortlist and contact operations independently enforce their stricter consent gates.

## Employer journey

1. Sign in as an existing company owner/reviewer. Open **Find candidates**, linked in organization navigation and at `/portal/company/directory`.
2. Select the company through existing company context. No academic or credential-issuing permission is required. Registration/ownership is not proof of a company's legal identity.
3. Search names, public professional headlines, skills or public project titles/descriptions. Add an exact, case-insensitive skill filter, **Has published credentials**, or **Has a published assessed-work summary**.
4. Results are paged on the server, **20 per page**, alphabetical by display name and stable profile ID. No skill-quality ranking is implied. Inputs/page bounds are validated. Counts and filters use exactly the public, discoverable subset; private profiles, unaccepted/unpublished credentials, submitted/rejected work and hidden assessments do not affect results.
5. Cards show public name/headline, up to eight skills, two portfolio summaries (query matches first), two published credentials with actual current/expired/revoked/not-yet-valid status, two public achievement summaries and a Passport link. Skills/projects are owner-added; achievements are company-approved; credentials are organization-issued. None is presented as independent proof of competence. A credential filter means published, not necessarily current or accredited.
6. Expand **Save to shortlist**, add an optional internal note (500 characters), and save. Team members may update the note or remove the save. The database stores only candidate ID, company ID, note and save metadata—not a copied Passport, evidence file or email. Do not paste private evidence into notes.
7. Open **Private shortlist** to use the same server-side filters/pagination. Entries/notes disappear from accessible results immediately when the candidate is private or opts out. The underlying organization save is retained, without a profile snapshot, and may reappear if the person opts back in. Organization members can remove a known saved ID even while it is unavailable; the UI does not enumerate hidden entries or reveal their counts.
8. If contact is enabled, expand **Request contact**, write a 20–1000-character purpose and optionally choose one of the company's open published challenges/paid projects. No arbitrary external link is accepted. A paid-project link remains clearly marked as devnet test-token work.
9. Send the in-app request; see it at `/contact-requests?view=outgoing&company=…`. Nothing is emailed. Acceptance is interest, not an application, employment contract, credential or payment commitment.

## Recipient contact journey

1. Open **Contact requests** in secondary navigation (`/contact-requests`). This is a paged in-app inbox, not a general notification or messaging service.
2. Inspect the actual company name, purpose and optional existing opportunity. Names are self-registered unless separate credential authorization says otherwise; the request is not an endorsement by ProofPak.
3. Accept or decline. Only the recipient can respond. Accept requires current public/discovery/contact consent and shares **no email, phone or private contact details**. A candidate can withdraw a previous acceptance by declining; declines cannot be reversed by the company or retried as new requests.
4. If an opportunity is linked and still open, follow its existing apply/submit workflow. Closed/private/unavailable opportunities are identified instead of advertised as open links. With no opportunity, acceptance records interest only; there is no chat, reply text, automatic introduction or out-of-app contact handoff.
5. Company members see the decision while the candidate remains public, discoverable and contact-enabled. Withdrawal of those settings hides the request/candidate from company contact views. The recipient retains their own incoming history and may decline even when no longer discoverable.

Limits enforced in SQL, not just buttons:

- One request per company/candidate pair, including previously declined requests. There is no resend/reset button.
- Ten new requests per company in a rolling 24 hours.
- Ten new requests per authenticated sender across companies in a rolling 24 hours.
- At most twenty pending requests in a candidate inbox.
- Self-contact and requests to existing members of the same company are refused.
- Exact ownership, publication, deadline and type checks on optional linked opportunities.
- Row locks serialize duplicate/rate-limit checks. Tests include concurrent duplicate REST submissions.

These are basic abuse limits, not a complete anti-fraud system. Multiple malicious accounts/companies, complaint handling and independent business identity review need later operational controls.

## Database/security design

Migration: `supabase/migrations/202611050004_employer_discovery.sql`.

| Object                                                        | Access / purpose                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles.is_discoverable`, `profiles.allow_contact_requests` | Owner preferences, false by default. Existing public/private profile RLS and public URL behavior retained.                                                                                                                                                          |
| `achievement_sharing.share_assessment`                        | Owner-controlled discovery-summary permission, false by default. Existing owner-only sharing policies retained.                                                                                                                                                     |
| `employer_shortlists`                                         | Composite company/candidate key, private note, saver and timestamps. SELECT only for current company members and currently discoverable candidates. No client raw writes.                                                                                           |
| `contact_requests`                                            | Company/candidate/creator, purpose, optional foreign-key opportunity, pending/accepted/declined and timestamps. Internal raw SELECT only for the company while the candidate remains contactable. No raw client writes.                                             |
| `visible_contact_requests`                                    | Fixed, authenticated, consent-filtered projection for recipient/company UI. Omits staff `created_by`, emails and phone fields. Recipient keeps their inbox history; unrelated users see no rows.                                                                    |
| `search_passports`                                            | Authenticated company-member-only RPC, fixed response shape, server filters/counts/paging. Explicit publication + directory predicate even though the trusted function can read underlying tables. Private notes always scoped to the requested authorized company. |
| Preference/save/remove/request/response RPCs                  | User-derived identity and membership, ownership, consent and rate-limit guards; no server service-role key required.                                                                                                                                                |

The recipient-safe view intentionally uses trusted-owner execution and a security barrier plus explicit `auth.uid()`/membership/consent predicates, because the recipient must not read internal staff attribution from the raw table. Do not grant the private table broadly or change this view to an unrestricted projection to silence a generic definer-view warning.

Only company membership authorizes employer tooling. Credential issuer status and type permissions are untouched and do not grant employer access to unrelated companies. Platform administrators do not get a special directory/shortlist bypass. Search predicates never inspect private submissions, evidence links, assessment outcomes or staff records. Public portfolio projects use the existing profile-level publication model; no new per-project privacy feature is claimed.

Stable database keys and current live reads, rather than copied profile snapshots, make changes to name/slug/public content and privacy effective. Existing SQL permissions still permit already published records and legitimate review relationships outside the directory; no anti-scraping guarantee is made.

## Release and migration checklist — not executed remotely

1. First rehearse in a named isolated test project. Before a later production change, confirm the exact target, retain a usable backup/recovery export and record current deployment SHA. No production settings/data are changed by this task.
2. Confirm all prior reviewed migrations through `202611050003_challenge_assessments.sql`, including issuer-trust and paid-project privacy dependencies. Do not rerun the initial schema.
3. Run `docs/check-employer-discovery.sql` read-only. Before first application: new tables/view/functions/columns absent; profiles, achievement sharing, credentials and structured-assessment prerequisites present. Unexpected objects require investigation, not blind reapplication.
4. After explicit approval, apply the complete new migration **once** inside its transaction. No users, credentials, achievements or historical proofs are deleted/recreated. Directory/contact/assessment-summary defaults are false. Do not bulk opt people in based on their old publication or credential status.
5. Re-run metadata and baseline counts. Expect both new raw tables with RLS, SELECT-only client access, protected mutation/search RPCs unavailable to anonymous users, and a safe view with no staff attribution. Original record counts and claim/proof fields remain intact. Existing helper checks/defaults and new indexes should be present.
6. Deploy matching code only after schema exists. The old directory has been replaced, not retained as an unsafe fallback. A fresh new directory may be empty until actual people deliberately opt in. Do not insert fake candidates or claim empty means an outage.
7. Verify two real organization accounts plus candidate/outsider in the isolated hosted preview: filters/counts, pagination, note isolation, private/opt-out transitions, contact refusal/acceptance/withdrawal and quotas. Hosted testing remains deferred; local fixtures do not prove real deployment or email/session behavior.
8. Do not push, merge, deploy production, send contact requests to real users, run hosted migrations or broadcast blockchain transactions without the respective approval.

Recovery: an SQL error rolls back the transaction. After a connection loss inspect actual objects/history before retrying. Retain rows and preferences; do not disable RLS, restore the old unconsented directory, reset data, opt users in, or rewrite proof claims. Fix forward/redeploy a compatible candidate. Ordinary Passport URLs and credential/payment workflows are unchanged, but new code requires the new schema.

## Automated evidence

| Check                                         | Passed    | Failed | Skipped |
| --------------------------------------------- | --------- | ------ | ------- |
| Unit tests (`npm test`)                       | 70        | 0      | 0       |
| Database/security/preservation suites         | 10 suites | 0      | 0       |
| Direct local PostgREST privacy/workflow tests | 34        | 0      | 0       |
| Desktop/mobile browser suite                  | 140       | 0      | 0       |

Lint, TypeScript, formatting and production build passed. Six focused browser cases also passed in a final rerun; they repeat a subset of the 140 cases, not six additional unique tests. Coverage includes opt-in defaults, publication independence, hidden project/credential/assessment filters, stable server paging, membership isolation, note updates/removal, consent withdrawals, safe recipient projections, concurrent duplicates, direct API write denial, company/sender quotas and recipient pending capacity. Existing Passport, assessment, credential, proof and payment regression suites remain included.

The first new REST test run had one test-helper failure: JavaScript’s default role argument sent an authenticated request instead of the intended anonymous request. The helper/test invocation was corrected; server permissions were not weakened. Final results above are successful fresh runs.

Workspace evidence: `/tmp/task6-lint.log`, `/tmp/task6-types.log`, `/tmp/task6-unit.log`, `/tmp/task6-format.log`, `/tmp/task6-build.log`, `/tmp/task6-db.log`, `/tmp/task6-rest.log`, `/tmp/task6-browser.log`, `/tmp/task6-browser-focused.log`. These are local artifacts, not production verification.

Local database tests use disposable PostgreSQL only; real direct API checks use disposable PostgREST with synthetic JWT accounts. Browser fixtures are explicitly offline and cannot save/contact real people. No hosted accounts, real user outreach, emails, wallets or blockchain transactions are tested or created.

## Remaining limitations and next task

- No general chat, private email exchange, outbound notification, automatic interview scheduling or ATS pipeline. A request without an opportunity records interest only. Users must check the in-app inbox; no delivery notification is claimed.
- Public Passport content remains public outside the directory, and legitimate access to submitted work remains. Directory opt-out is not global erasure or protection against outside indexing.
- Hidden saves/requests are retained as private history rather than deleted; only their currently permitted portions are readable. Retention/export/deletion policy needs a separate review.
- Search is a bounded server-side substring/exact-skill implementation, not relevance/competence ranking. Larger deployments may need measured full-text/trigram optimization and abuse monitoring.
- Existing owner/reviewer membership permissions are reused; team invitations and fine-grained employer roles are not added.
- Assessed summaries require their own explicit owner opt-in and a real structured approved review. No unsupported equivalence between achievements, credentials and blockchain truth is introduced.
- No legal/business identity guarantee, anti-sybil completeness or real employment/payment promise is made. Paid opportunities remain devnet test-token workflows.
- Existing dependency advisories, appeals, credential replacement, real-mail/physical-wallet acceptance and hosted schema verification remain separate concerns.

Recommended next task: validate Passport → deliberate directory opt-in → employer search/save → candidate-controlled contact → optional existing opportunity application in the isolated hosted preview when the founder is available, alongside the previously completed credential journey. Do not add messaging or another product feature before recording that evidence.
