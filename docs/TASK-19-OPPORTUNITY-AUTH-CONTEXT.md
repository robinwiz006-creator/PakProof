# Task 19 — Preserve opportunity context through authentication

**Date:** 10 November 2026 (Asia/Karachi). **Branch:** `task-19-opportunity-auth-context`, created from the existing `task-17-release-readiness` checkout at `17b3dc8`. Previous uncommitted changes and untracked reports were preserved.

## Root cause

Paid-project detail linked to login without a destination. The existing return validator accepted challenges only. Login validation/provider failures, login/signup switching, signup confirmation and resend confirmation did not consistently retain the chosen opportunity.

## Implemented flow

1. Challenge submission links carry a canonical `/challenges/<uuid>#submit` destination; paid-project login links carry `/paid-projects/<uuid>`.
2. Authentication pages validate the destination before rendering it in forms or links. They explain that the user can continue to the selected challenge/project after signing in.
3. Switching login/signup (including the global header links) and retrying validation, provider or configuration failures retain that validated destination in the URL and hidden form field. Refreshing the GET page does not discard it.
4. Signup places the validated destination in the existing Supabase email callback URL. Pending-email signup returns to login with the same destination. Immediate-session signup returns directly to the opportunity.
5. Successful callback code exchange with a user/session returns to the destination. Confirmation failure supplies a safe login/resend retry with the destination, without echoing the code or provider error. Resend confirmation uses the same callback builder.
6. Password-recovery callbacks still go to `/reset-password`; an opportunity parameter cannot override this.
7. Already authenticated visitors to login/signup are sent to their allowed opportunity or normal preferred dashboard. They do not enter a login loop.
8. An expired session during challenge submission or an existing paid-project action retains a permitted opportunity destination. Submitted work, applications and agreements are **not replayed** after login. Users must review and submit again; unsaved form contents are not carried through authentication.
9. Closed challenges show the closure message before asking logged-out visitors to sign in. Existing paid-project eligibility checks still close applications when unavailable/expired. Private/deleted/unavailable records get a neutral opportunity-specific not-found message and a discovery link.

No new cookies, browser storage, Auth provider, environment variable, database object or migration is needed. The selected destination is ordinary nonsecret URL context. It grants no access; existing RLS, membership and action validation remain authoritative.

The first full browser run also exposed a local/proxy-origin problem inherited from the callback: reconstructing an absolute redirect from `request.url` used the server bind host `0.0.0.0`. The callback now returns a validated **relative Location** with `Cache-Control: no-store`, preserving the browser's origin without trusting forwarded-host input. Browser tests assert the final origin and visible retry form, not just the path.

## Redirect boundary

Only these lowercase UUID route forms are accepted:

- `/challenges/<uuid>`
- `/challenges/<uuid>#submit`
- `/paid-projects/<uuid>`

Absolute URLs (including this site's own absolute URLs), protocol-relative URLs, query strings, other anchors, encoded paths, traversal, whitespace/backslashes, arbitrary dashboard/API/Auth paths and malformed identifiers are rejected. Missing/rejected context falls back to the user's preferred personal/organization dashboard after successful authentication. The callback, actions and pages each validate context; it is not trusted merely because it came from an email or hidden form.

Opportunity availability is checked by the destination route under its existing permissions, not by querying private records on the login page. Returning is navigation only: no application, acceptance, publication, transaction or payment is automatic.

## Files changed

| Area                                                  | Files                                                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared safe navigation and tested Auth orchestration  | `src/lib/auth-navigation.ts`, `src/lib/auth-flow.ts`, `src/lib/passport.ts`                                                                     |
| Real server-action adapters                           | `src/lib/actions.ts`                                                                                                                            |
| Login/signup/callback                                 | `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/auth/callback/route.ts`, `src/components/navigation.tsx`                       |
| Resend confirmation                                   | `src/app/resend-confirmation/page.tsx`, `src/components/recovery-form.tsx`                                                                      |
| Opportunity entry links and closed challenge guidance | `src/app/challenges/[id]/page.tsx`, `src/app/paid-projects/[id]/page.tsx`                                                                       |
| Safe unavailable-opportunity presentation             | `src/components/opportunity-unavailable.tsx`, the two opportunity `[id]/not-found.tsx` boundaries                                               |
| Expired-session return destinations only              | `src/lib/credential-data.ts`, `src/lib/paid-actions.ts` — no paid-project, settlement, wallet or credential business rule changed               |
| Local tests/fixture                                   | `tests/auth-context.test.ts`, `tests/e2e/auth-context.spec.ts`, `tests/e2e/opportunity-ux.spec.ts`, `src/components/opportunity-ux-fixture.tsx` |
| Delivery record                                       | This document                                                                                                                                   |

The Auth functions are extracted behind small provider callbacks so unit tests exercise the same orchestration the real actions use. Production adapters still call the existing Supabase SDK; there is no simulated login/session path in the application.

## Validation

Unit tests use synthetic provider results and fake `.invalid` email addresses; they do not register hosted accounts or exchange real codes. Browser tests explicitly blank hosted credentials and exercise real local pages/actions plus labeled opportunity fixtures. Authentication successes are provider-mocked unit coverage, not real hosted sessions.

| Check                                                | Result                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit suite                                           | Initial full runs: 117 passed, 0 failed, 0 skipped; final full run including header coverage: **118 passed, 0 failed, 0 skipped** (13 new tests) |
| Initial complete desktop/mobile browser suite        | 220 passed, 2 failed, 0 skipped; the same callback bind-origin failure on desktop and mobile; no automatic retries                               |
| Complete browser rerun after callback fix            | **222 passed, 0 failed, 0 skipped**, no automatic retries                                                                                        |
| Final complete browser run including header coverage | **224 passed, 0 failed, 0 skipped**, no automatic retries; includes the header handoff tests on desktop and mobile                               |
| Lint                                                 | Passed, final exit 0                                                                                                                             |
| TypeScript                                           | Passed, final exit 0                                                                                                                             |
| Production build                                     | Passed, final exit 0; ordinary `.next` build with hosted service variables blank; not a hosted deployment                                        |
| Formatting                                           | Application/test formatting passed; this report also checked separately                                                                          |

Logs remain outside the repository under `/tmp/task19-*.log`. The initial browser failures were investigated and fixed, not relabeled as flaky or hidden with a retry. The full affected suite is rerun after the fix.

No database/REST fixture suites, backups, restores or hosted service checks are run for this application-only change. No SQL/migration or blockchain transaction is executed.

## Remaining manual verification

After a separately approved deployment to a schema-compatible environment:

1. Select a real published paid project while logged out; sign in with an existing account, including one failed attempt; confirm return to the same project and a permitted Apply action.
2. Repeat with a challenge and confirm the submission anchor. No submission should be created just by returning.
3. Switch between login/signup, refresh and confirm the destination remains.
4. Create a separate test account through the opportunity flow, open its genuine confirmation email in the same browser, and confirm return. Repeat using resend confirmation. An existing older email without `next` cannot retrospectively remember a destination.
5. Verify the existing Supabase redirect allowlist and email template preserve the generated `/auth/callback?next=...` URL. Custom templates that replace it with a fixed Site URL can discard context. No dashboard setting was changed by this task; review any required configuration separately, without broadening redirects unnecessarily.
6. Check an already logged-in visitor reaching login/signup. They should navigate directly to the opportunity/default dashboard, not loop.
7. Close/expire/remove the opportunity between login and return. Expect closed/unavailable guidance, not an automatic application or permission bypass.
8. Verify ordinary signup/login with no destination and password recovery still work.

Actual already-authenticated page navigation and cookie persistence still require real hosted sessions; local success coverage uses the shared provider-mocked orchestration and destination helpers.

PKCE confirmation still depends on the existing browser/session code verifier, email delivery and configured callback host. Cross-browser links, expired codes or providers stripping redirect parameters can require sign-in/resend. No claim of hosted verification is made until those tests are performed.

No push, merge, deployment, hosted configuration/data change, wallet operation or production migration is authorized or performed.
