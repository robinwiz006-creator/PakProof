# Task 23: Credential invitations

Based on Task 22 (`0dc1b69`). No production schema, configuration or transactions were changed.

## Workflow

Organizations → Credential invitations → Create a credential invitation. Only current authorized organizations and explicitly approved categories are offered. Enter email and existing credential fields, review, then create a private link. **Email delivery is not configured and no invitation email is sent.** Copy the one-time-displayed link and send it privately through your own trusted channel. If lost, cancel the pending invitation and prepare another. Invitations expire after 14 days; a daily limit of 50 per organization and duplicate pending-recipient/title/category prevention are enforced in SQL.

Recipients without an account see a generic introduction; private details are withheld until authentication. Sign-in, signup, failed retries and email-confirmation callbacks preserve only a strict internal invitation route. Supabase Auth must have the existing callback URL allowed, including its query parameters. No new provider keys are needed. New accounts must confirm their email; existing users must sign in with the intended verified email. A recipient's inbox is also available at `/credential-invitations`, including from My Credentials and Needs your attention.

Acceptance creates one credential atomically, marked accepted but private with evidence sharing off. The Passport is not published. Publication, proof anchoring, correction and revocation use the existing workflows. Invitation acceptance is not institutional or blockchain verification. No wallet is required.

## Security and release

Migration: `202611100002_credential_invitations.sql`, ordered after Task 22. It needs the existing organization/category permissions, immutable credential issuance audit, credential evidence/preferences and Auth email columns. Apply only through a separately authorized coordinated migration release; production migrations and backup preparation remain paused.

A 256-bit token is generated with Node crypto; only its SHA-256 hash is stored. Raw token, creator UUID and creation approval reference have no client SELECT grant. All client table writes are denied; narrowly scoped definer functions enforce membership, current category authorization, expiration and transitions. Authenticated recipients must match `auth.users.email` and have a non-null confirmation timestamp. Possessing a token alone grants no access. Anonymous visitors receive no credential facts. Row locking and a unique credential ID prevent double issuance; creation limits use an organization advisory lock. Accepted credentials attribute issuance to the original representative, who must still be a member; the current approval is independently rechecked by the existing issuance trigger. Historical audit rows and v1/v2/v3 proof formats remain unchanged.

Recipient-only dashboard counts use a consent-scoped projection instead of counting all rows an organization member can manage. Missing schema yields an unavailable source rather than invented counts. Terminal decisions remain in history; expiration is derived from the fixed timestamp. An accepted credential's current validity is checked in the existing credential detail flow, not inferred from the invitation's historical status.

## Validation and limitations

Local PostgreSQL tests use disposable databases and synthetic accounts. Test bootstrap email columns model Supabase Auth; they do not change production Auth. Browser fixtures test review and navigation, not hosted delivery or actual authenticated Supabase mutation. Hosted confirmation, email-address changes, REST gateway behavior and two real accounts still need testing after migrations. No external email provider was integrated. No arbitrary redirects, public evidence uploads or automatic blockchain records were added.

### Recorded local results

- Unit suite: 140 passed, 0 failed, 0 skipped.
- Database: complete local migration chain and five SQL suites passed (invitations, existing credentials, issuer trust, corrections and assessment transparency); synthetic accounts only. No hosted REST tests were performed.
- Browser: initial run 23 passed/1 failed/0 skipped because a selector targeted a hidden desktop navigation link on mobile. After using the visible sign-in link, the complete selected suite passed 24/0/0 without automatic retries. Tests cover UI and auth handoff; they do not claim hosted email confirmation or real-account acceptance.
- Final lint, TypeScript, formatting and ordinary production build passed. Initial development type errors in a label import and schema composition were corrected before final validation.

The new schema is not deployed. Review on `task-23-credential-invitations` against `task-22-passport-history`; do not merge or deploy to main as part of this task.
