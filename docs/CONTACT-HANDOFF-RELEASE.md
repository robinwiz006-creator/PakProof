# Employer contact handoff — Task 13

## Existing limitation and reused functionality

Employer discovery already searched opted-in public Passports, stored company-private shortlists and sent consent-based contact requests. `/contact-requests` supported acceptance/decline and used the existing opportunity workflows. Its accepted state explicitly said that an unlinked request recorded interest only. Neither party could suggest or discuss a next step. Existing acceptance withdrawal was stored as `declined`; no messages or personal contact details were exchanged.

This implementation reuses that inbox, company memberships, profile visibility/discovery/contact consent, request creation limits, server actions and existing challenge/paid-project detail pages. It adds a small follow-up exchange, not live chat, recruitment automation or a public messaging service.

## Product workflow

1. An organization finds an opted-in candidate and sends the existing purpose-bearing request, optionally selecting its own open opportunity.
2. The candidate reads the purpose and accepts or declines in the existing inbox. Acceptance explicitly permits a bounded private follow-up; it shares no email or phone automatically.
3. Acceptance opens `/contact-requests/[id]`. Both parties see the organization, purpose, current contact status and any eligible linked opportunity. Organization users also see the candidate's currently permitted public name/Passport link, never a stored private-profile snapshot.
4. Either party can send a **next steps**, **question** or **response** note of 10–1,000 characters. Each side has six notes per request. Authorized organization members share the organization's six-note allowance.
5. The candidate can **Close contact**. An organization can **Withdraw request** while pending or accepted. These transitions are terminal and preserve private history. Declined/closed/withdrawn requests cannot reopen or accept more notes.
6. A candidate may separately apply or submit through a linked opportunity. Contact acceptance never creates an application, agreement, credential or payment.

There are no attachments, live typing, realtime delivery, full conversation search, read receipts, outgoing email notifications or automatic contact-data sharing. Users check/refresh the existing contact inbox. They can voluntarily type contact details into a note after seeing the disclosure; ProofPak never inserts account email/phone data.

## Privacy and authorization

- No anonymous handoff access. The server authenticates via existing Supabase sessions; database RPCs independently enforce recipient or current company membership.
- `contact_followups` is an immutable private ledger. Direct API writes are revoked for all application roles. Its full audit rows (including actor ID and retry nonce) are readable only by current members of the relevant company while candidate contact consent is current. Service-role access remains server-only; it is not used by the new application flow.
- Candidates and organizations read `visible_contact_followups`, a fixed recipient-safe projection with no staff actor ID, nonce, shortlist note, email or phone fields.
- A candidate can read their own private request history even after opting out or closing. Company access additionally requires a currently public, discoverable, contactable Passport. Making the Passport private or disabling discovery/contact immediately prevents further writes and company reads.
- Disabling discovery/contact pauses an otherwise accepted channel; re-enabling it permits continuation only if it was not explicitly closed/withdrawn/declined. Use **Close contact** for a permanent stop. Previously viewed information cannot be recalled from another person's browser.
- Membership in an organization is separate from credential-issuer permission. Academic/credential authorization is not required for contact. Members cannot impersonate another organization or the candidate: sender side and actor are derived server-side.
- Existing unique company/candidate request and request quotas remain unchanged. Closed requests cannot be bypassed by creating a second request for the same company/candidate.
- Per-request locking makes sends and closure linearizable: a note may commit immediately before closure, but none may be sent after closure wins the lock. Existing notes remain readable under the same privacy gates.

### Duplicate and spam controls

A server-rendered form carries a random submission nonce. The database atomically records it with the note. While contact remains open, an exact retry from the same actor returns the original note ID, without adding another note or consuming more quota. Reusing the nonce with changed content or another actor is rejected. Refreshing the detail page creates a fresh form nonce for a deliberate new note.

Limits are six notes per side/request, 20 per actor/24 hours, and 40 organization notes per company/24 hours. Consistent actor/candidate-profile, company and request locks serialize quota checks and concurrent requests. Existing request limits (10/company and actor/24 hours, 20 pending/candidate, one request/company/candidate) remain in force. There is no public send endpoint; authenticated PostgREST RPC access is still subject to these database checks.

## Linked opportunities

`contact_request_opportunity` checks participant access and rechecks the opportunity's company ownership. It reads only title, public lifecycle information and deadline; operational paid-project fields never enter the response.

- An open, published, unexpired opportunity provides its existing detail URL and a clear view/apply action.
- Past-deadline, closed, selected/active or completed opportunities have no apply action and are shown as closed.
- Draft/withdrawn/cancelled or invalid company-mismatched references return unavailable, with no private title, deadline or URL.
- Paid-project disclosures continue to say devnet test tokens have no monetary value and payment is not guaranteed.
- Closing contact does not cancel a separate application, challenge submission, agreement or payment.

## Database migration and release

New migration: `supabase/migrations/202611070001_contact_handoff.sql`.

It adds `contact_followups`, RLS, immutable-history protections, a safe read view, send/close/opportunity RPCs and two terminal request statuses (`closed`, `withdrawn`). It replaces the response function to prevent reopening ended requests. Existing request rows, staff attribution, statuses, timestamps and notes are not rewritten or deleted. Historical `declined` rows retain their original provenance limitation; prior decline and withdrawal-of-acceptance cannot be retrospectively distinguished.

The feature directly depends on employer discovery (`202611050004`) and existing challenge/paid-project models. For this complete branch, apply the full outstanding migration chain in filename order, including Task 12's `202611060002`, before this new `202611070001` migration. Do not rerun already-applied files or initial migrations. No environment variables, credentials, email provider or wallet configuration are added.

1. Confirm the intended isolated preview project and applied migration history. Retain a usable backup and read-only request counts/fingerprint before changes.
2. Run `docs/check-contact-handoff.sql` read-only before and after migration. Before application, new objects should be absent and existing request data healthy. Afterward, confirm RLS, safe-view grants, read-only raw access, function grants and matching old request counts/fingerprint (in a quiet window).
3. With separate explicit authorization, apply the complete migration once in its included transaction. Any failure rolls it back; stop and investigate rather than running fragments.
4. Deploy matching code to preview only after the database is ready. New code needs the new view/RPCs. Older code does not explain new closed/withdrawn states; avoid an extended mixed-version window and do not use the new handoff until matching code runs everywhere.
5. Complete the hosted acceptance steps below before approving a production release. No hosted migration or deployment was performed during Task 13.

Do not delete threads or restore an old database over newer credentials/payment receipts to roll this feature back. If code release fails, pause handoff use, preserve the additive migration/history, and fix forward. A closed channel must not be reopened by manual SQL. Any future reopening process requires new explicit consent and separate reviewed design.

## Founder-led preview acceptance

Use synthetic test accounts only: an organization owner, another member of the same company, a separate candidate, a different organization and unrelated candidate. Keep passwords/keys out of evidence.

- Send an unlinked request. Confirm pending requests cannot send notes. Accept it, send a short note from both sides, refresh, and confirm history is unchanged.
- Send an eligible linked request from another consenting candidate/company pair. Confirm the displayed organization and opportunity are correct, the existing detail page opens, and no application/payment was created.
- Withdraw/close or expire the opportunity through its own controls. Confirm the contact page removes the apply action and shows the accurate closed/unavailable state without private project fields.
- Decline a pending request. Confirm neither side can continue. Test organization withdrawal while pending and accepted.
- Close accepted contact as the candidate. Confirm history remains and sending/reaccepting fails from the UI and direct authenticated REST.
- Make the Passport private or disable discovery/contact. Confirm organization access disappears immediately and further notes are blocked. Restore preferences: explicitly closed contact must remain closed.
- Test a second organization, unrelated candidate and Incognito browser: no private exchange or actor/nonce data should be available. Verify private shortlist notes never appear in the contact page.
- Retry the same submission and test refresh/back navigation: no duplicate note. A deliberate new note uses a fresh nonce. Reach the six-note allowance and confirm the next note is rejected.
- Repeat at 320px/390px and desktop widths. Test keyboard controls and confirmation before closure.

No physical wallet, blockchain transaction or hosted email setup is required for this feature. Existing wallet/payment/credential tests still provide regression coverage; their live end-to-end behavior remains a separate manual validation requirement.

## Limitations and recommended next task

This resolves the accepted-request dead end, not all employer communication needs. There are no notifications outside the inbox, no attachments and no guaranteed delivery/read indication. Contact opt-out temporarily hides organization history; explicit closure is permanent. Already sent notes are retained rather than editable/deletable. Broader moderation/reporting and retention/export policies require separate work before wider adoption.

Recommended next task: perform the isolated hosted two-account acceptance walkthrough across discovery → contact → existing opportunity application, including consent withdrawal and a second organization isolation check, before adding communication features.

## Automated validation

| Check                                              | Passed | Failed | Skipped |
| -------------------------------------------------- | -----: | -----: | ------: |
| Unit tests (`npm test`)                            |     93 |      0 |       0 |
| Isolated database suites (`npm run test:db`)       |     15 |      0 |       0 |
| Direct PostgREST security (`npm run test:privacy`) |     61 |      0 |       0 |
| Full desktop/mobile browser suite                  |    182 |      0 |       0 |

Lint, TypeScript, formatting and the explicit production build passed (exit 0). No browser retries were needed. The eight new browser cases cover offline handoff presentation/actions on desktop/mobile, including 320px layout. Database/REST tests use real disposable local PostgreSQL/PostgREST with synthetic account roles, not production or hosted Supabase. The database tests include a populated pre-handoff upgrade, unchanged request fingerprints, company-wide quotas across multiple representatives, and historical credential/payment regressions. REST tests include idempotent/concurrent sends, recipient closure races, unrelated organization/candidate access, direct write attempts, and privacy withdrawal.

During development, initial REST runs passed 58/60 and 59/60 while test fixtures used a nonexistent lifecycle RPC and a candidate opted out by a prior test. Corrected fixtures passed 60/60; the final expanded suite passed 61/61. These failures were not bypassed by weakening authorization.

Hosted Auth, real-user usability and hosted RLS/schema configuration remain unverified. No remote migrations, production writes, deployments, wallet interactions or Solana transactions were performed.
