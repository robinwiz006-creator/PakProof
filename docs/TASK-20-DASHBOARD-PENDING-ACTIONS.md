# Task 20 — Dashboard pending actions and user guidance

**Date:** 10 November 2026 (Asia/Karachi). **Branch:** `task-20-dashboard-pending-actions`, created directly from Task 19 commit `3b2317f`. Task 19 application behavior is preserved. Existing unrelated working files and untracked reports remain outside this task.

## 1. Existing states found

This implementation reuses saved workflow states. It does not create notifications, unread flags, new tables, events, email delivery or a background job.

| Workflow                  | Existing actionable state                                                                                      | Current actor / limitations                                                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Received credential       | `credential_preferences.acceptance = pending` for the current recipient                                        | Review in My Credentials; includes corrected replacements. A pending decision does not mean the record is currently valid or eligible for acceptance.                                        |
| Challenge feedback        | Current user's submission is `needs_improvement`                                                               | Review feedback and resubmit through the existing workflow.                                                                                                                                  |
| Project offer             | Project is `offered` to the current worker                                                                     | Review current agreed terms; acceptance/decline stays on the project page.                                                                                                                   |
| Milestone work            | Worker owns an active project; milestone is `not_submitted` or `revisions`                                     | Submit agreed work or address feedback; no automatic submission.                                                                                                                             |
| Contact request           | Current candidate's visible request is `pending`                                                               | Review/accept/decline in the existing consent-based inbox.                                                                                                                                   |
| Challenge review          | Selected organization's submission is `pending`; reviewer is not the submitting person                         | Membership required; no self-review task.                                                                                                                                                    |
| Milestone review          | Selected organization's active project has a `submitted` milestone; reviewer is not its worker                 | Approval and payment remain separate.                                                                                                                                                        |
| Applications              | Application is `applied` on a selected-organization `published` project; not the reviewer's own application    | An application deadline blocks new applications, not necessarily selection from existing applications. The summary follows the existing selection function, not an invented review deadline. |
| Qualification requests    | `pending` requests for a university currently authorized for `degree` credentials                              | Organization membership and current explicit category permission required; self requests excluded.                                                                                           |
| Existing payment attempts | Current payer's intents are `prepared`, `registered`, `pending` or `needs_review` in the selected organization | Organization owner only; link says **check status**, never “pay again.” No chain call is made by the summary.                                                                                |
| Institutional review      | Existing `administrator_verification_queue`                                                                    | Platform administrator only; own organizations excluded.                                                                                                                                     |
| Category approval         | Existing organizations with `issuer_status = pending`                                                          | Independent platform administrator only; category permission and institutional trust are separate.                                                                                           |

Evidence: migrations `202610110001_initial`, `202610120002_organizations_credentials`, `202610120005_paid_projects`, `202610120006_milestone_payments`, `202611050002_issuer_trust`, `202611050004_employer_discovery`, `202611050005_paid_project_lifecycle`, `202611060002_credential_corrections`, `202611070001_contact_handoff`, and `202611070002_organization_verification`. Existing review/selection functions, not inferred marketing claims, determined the actionable states.

There is no separate candidate-to-issuer “correction request” queue. Corrected credentials use the existing recipient decision state and appear once in the credential summary. Waiting for someone else's approval, optional publication, optional proof anchoring and accepted-contact “unread replies” are not invented as mandatory tasks.

## 2. Dashboard behavior

### Personal Home — `/portal/talent`

A compact **Needs your attention** section appears for signed-in users above the existing Passport-first actions. Priority: agreed milestone work/challenge revisions, offers, credential decisions, then contact decisions. Each row includes a title, accurate count, status, short explanation and a link to the existing workflow.

It does not show organization review or administrator tasks, even if the account also belongs to an organization. It does not replace Build my profile, Find opportunities or Credentials.

### Organization Home — `/portal/company`

The section covers the selected organization only. Existing memberships are reused and checked; an unrelated `company` parameter is already rejected by the portal, and the loader also rejects an unknown membership. Users with multiple memberships get a named organization selector.

Owner payment-status checks come first for safety; then challenge/milestone reviews, permitted qualification reviews and project applications. A reviewer does not receive owner-only payment actions. A nonissuer or issuer without degree permission does not receive qualification-review actions.

Counts are for the selected organization. Challenge review links preserve its `company` parameter. Some existing destination pages (`/paid-projects?view=company`, `/organizations?view=requests`, `/payments`) are aggregated workspaces and can show other organizations the person legitimately belongs to. This task does not claim to implement a platform-wide persistent organization selector or redesign those existing workflows.

### Platform administration — `/issuer-admin`

The existing administrator RPC check remains mandatory before rendering the page. The summary separates institutional verification from category approval. It excludes every organization in the administrator's own membership list. If that permission list fails or is truncated, independent-review counts are withheld rather than guessing.

The existing administration list/statistics now distinguish unavailable results from zero, so one list/count failure does not discard the independent attention results. Existing private review panels, self-authorization prohibition and audit records are unchanged.

## 3. Empty, loading, failure and retry states

- A Suspense fallback says **Checking your actions…**, with no invented zero counts.
- Known positive results display rows. Independent sources run concurrently and are sorted by explicit priority.
- If all applicable sources return valid zero counts, show **No pending actions in the workflows checked here**. This is not a claim about every possible platform workflow.
- If one source fails, show its friendly source label and retain valid rows from other sources. Raw SQL, provider errors, private evidence and investigation details are never sent to this UI.
- If every source fails, show the unavailable notice and retry control; never the no-pending message.
- Without a selected organization, show setup guidance instead of claiming no tasks exist.
- **Check again** uses a real `router.refresh()` transition, preserves the current URL/organization and requests fresh server rendering. It does not add a fake progress counter. A no-JavaScript reload link is available.
- Profile-project count failures on personal Home are reported as unavailable rather than hiding the attention section or displaying zero.
- Demo mode does not fabricate pending records or real account actions. The explicit offline test fixture is isolated by the existing `/test-ui` protections.

## 4. Performance and privacy

- Uses the existing authenticated, request-scoped Supabase client and current user. No service-role reads, new API endpoints or public attention data feed.
- Mostly uses `HEAD` requests with exact counts, explicit user/company/status filters and narrow inner joins. No submissions, private URLs, identity documents, contract terms, wallet addresses or financial amounts are fetched for the summary.
- Normal request budgets: five summary counts for personal Home; four organization counts/permission checks for a nonowner, with one extra payment count for an owner. A permitted qualification check uses a narrow organization lookup followed by its count. Administrator summaries use a bounded own-membership read and two independent counts. These are parallel where independent; each HTTP query has an eight-second timeout.
- Personal Home's existing full project read is replaced with a count-only read. Company Home no longer separately downloads all challenge/submission rows for its old summary. Other portal sections keep their existing workflow queries.
- Administrator summary counts are separate from existing overview counts because independent-review eligibility excludes the administrator's own organizations. Ordinary overview totals must not be reused as actionable independent-review counts.
- No cross-user shared result cache is introduced. Refresh/navigation re-reads current saved state. Resolving a task in the existing workflow removes it on the next dashboard read; there is no read/acknowledged notification state.
- RLS and existing backend functions remain authoritative. UI context and count filters do not grant permission to issue, review, approve, accept or pay.
- Payment rows advise checking the original attempt. No settlement logic, Solana transaction, wallet rule, receipt, proof format or recovery mechanism is changed.

## 5. Tests and results

Tests use actual SDK request construction with an intercepted `.invalid` fixture endpoint. They verify selected fields, HEAD counts, filters, role gating, organization selection, self-review exclusion, complete permission reads, source isolation, invalid count handling, sorting and destinations. They are **not a real PostgREST/RLS execution or hosted authorization test**.

Browser tests use the existing isolated Playwright harness with hosted keys blank. They cover role-specific presentation, loading/empty/partial/all-error states, real refresh requests, links, keyboard focus, 320/390/1280px layouts and the absence of fabricated actions on demo dashboards. The production test-fixture route remains disabled under ordinary hosted configuration.

| Check                      | Result                                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit suite                 | **128 passed, 0 failed, 0 skipped** on the final full run; 10 new count/scoping tests. Earlier full runs also passed.                                                                                                                           |
| TypeScript                 | Initial run: one SDK call-order error (`abortSignal` after `maybeSingle`). Fixed by attaching the signal first; final full check exited 0.                                                                                                      |
| Lint                       | Initial check passed; one concurrent run exited 2 because Playwright removed `test-results` while ESLint was scanning it (ENOENT). Rerun sequentially after browser testing: passed, exit 0. No lint assertions or configuration were weakened. |
| Formatting                 | Full application/test check passed; this document passed its targeted Markdown check.                                                                                                                                                           |
| Production build           | Passed, exit 0 on the final ordinary `.next` build, with hosted service variables blank. Not a production-configured deployment test.                                                                                                           |
| Initial full browser suite | **234 passed, 2 failed, 0 skipped**. Both failures were mobile Auth navigation/refresh synchronization races. No automatic retries.                                                                                                             |
| Full browser rerun         | **236 passed, 0 failed, 0 skipped**, no automatic retries; includes all 12 desktop/mobile attention checks and Task 19 regressions.                                                                                                             |

The Auth tests checked shared fields before navigation necessarily committed: one reloaded before signup finished, and the other filled an email field before confirmation navigation finished, leaving the destination form empty. The traces showed those intermediate pages. Tests now explicitly wait for the intended URL and heading before reload or filling destination fields. No authentication behavior, assertion removal, skip or timeout increase was used to obtain a pass.

Database, direct REST, hosted account and physical-wallet tests are not run for this read-only application change. No migration, backup or restore is run. The founder-confirmed outstanding production schema work remains outside this task.

## 6. Remaining limitations and manual verification

1. Actual saved-state counts, joins, permissions and streamed loading need reserved hosted accounts on a schema-compatible deployment. The production migration gap is not resolved here; unavailable resources should produce partial/unavailable notices.
2. Attention rows group records by workflow and link to existing workflow lists; they are not a replacement for those lists or an application/credential administration page.
3. Existing destination workspaces may aggregate authorized memberships, as noted above. Source counts never mix the selected organization's records with another organization's counts.
4. No pending-count read is a live Solana settlement check. Approved unpaid milestones without an existing payment intent are not automatically classified as a payable obligation by this summary.
5. There is no unread tracking, automatic email, deadline escalation, full messaging, correction-request intake, moderation queue or new alert system.
6. Counts from independent reads are a current best-effort overview, not one atomic cross-feature snapshot. Existing mutation functions recheck authority and state when the person actually acts.
7. Administrator own-membership lists over the bounded limit are reported unavailable pending an operator/UI improvement, rather than producing incomplete self-review exclusions.

Manual walkthrough: use a candidate, organization owner, reviewer, degree-authorized university member and independent platform administrator. Create actual pending states through existing UI only when separately authorized; compare the dashboard against each workflow list. Switch between two organizations, try an unrelated organization URL, resolve one task and refresh, revoke/suspend the relevant permission and recheck. Verify no private evidence appears in summary responses or unauthorized account views. Perform no payments or wallet transactions merely to test this section.

## 7. Files changed

- `src/lib/dashboard-attention.ts`: scoped counts, role rules, sorting and independent-source outcomes.
- `src/components/dashboard-attention-data.tsx`: authenticated server integration.
- `src/components/dashboard-attention.tsx`: shared summary, loading/empty/failure presentation.
- `src/components/attention-retry.tsx`: real route refresh.
- `src/app/portal/[...section]/page.tsx`: home integration, membership context, lighter reads.
- `src/app/issuer-admin/page.tsx`: administrator integration and truthful unavailable counts.
- `src/app/globals.css`: compact responsive rows using existing brand tokens.
- `src/components/dashboard-attention-fixture.tsx` and `src/app/test-ui/page.tsx`: isolated synthetic presentation fixture.
- `tests/dashboard-attention.test.ts`, `tests/e2e/dashboard-attention.spec.ts`: regression coverage.
- `tests/e2e/auth-context.spec.ts`: stronger navigation synchronization; Task 19 functionality preserved.
- This delivery document.

## 8. Git and release

Base commit `3b2317f` remains in the branch history (ancestry verified). Implementation commit: **`f89a9845938f406d40770266f8937e8960b1e94b`**. This document is committed separately so it can record that exact implementation SHA and the completed results. The final documentation commit is supplied in the delivery response. Existing unrelated work remains uncommitted/untracked as before.

Local evidence logs: `/tmp/task20-unit-complete.log`, `/tmp/task20-lint-release.log`, `/tmp/task20-type-release.log`, `/tmp/task20-format-release.log`, `/tmp/task20-build-release.log` and `/tmp/task20-browser-final.log`. Earlier failing runs are retained separately under `/tmp/task20-*`. Synthetic screenshots are under ignored `test-results/attention-*-desktop.png` and `attention-*-mobile.png`; these illustrate fixtures, not hosted records.

No push, merge, deployment, hosted configuration/data change, migration, backup, restore or blockchain transaction is authorized or performed. Stop for review before release.
