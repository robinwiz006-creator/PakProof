# Task 26: Organization teams

Uses the existing `company_memberships` and organization/company relationship. No second membership system or ownership-transfer shortcut was added.

## Use

Organization dashboard → Organization team. Select an organization you belong to. Members can see the team and their current role; owners/administrators see permitted management controls, paginated invitations and private audit activity. Owners may assign administrators and ordinary scoped roles. Administrators may manage only ordinary scoped members, not owners, administrators or legacy broad members. Self-role changes/removal are blocked. The last owner is protected at the database trigger level. Ownership transfer is deliberately unsupported.

Invite: enter email, choose role, review, then create and copy a seven-day private link. **No email is sent.** Cancel a pending invitation and create another to replace a lost link. Existing/new users sign in/register with the invited email and confirm it; safe login/signup/confirmation context returns them to review. Verified-email matching and atomic acceptance create the membership. Acceptance does not publish the Passport. Pending invitations appear in existing dashboard attention and `/team-invitations`.

## Roles and boundaries

- **Owner:** existing full organization access; can manage non-owner roles. Company payment signing and company-profile editing retain existing owner-only controls.
- **Administrator:** team management of ordinary members plus credential/opportunity/review/discovery workflows; cannot grant administrators/owners or sign company payments.
- **Credential manager:** approved-category credentials, credential invitations, corrections, revocations and relevant private issuance history. No opportunity, discovery or team management.
- **Opportunity manager:** challenges, paid-project management, reviews, candidate discovery/shortlists/contact invitations. Payment signing remains owner-only.
- **Submission reviewer:** authorized organization submissions/assessment decisions and their necessary challenge context. No creation, credential issuance, employer directory or team administration; unrelated private Passports/projects are not granted.
- Existing stored **`reviewer`** is labeled **Legacy member (existing access)** and retains its previous broad non-owner workflow permissions. Nobody is automatically promoted and this legacy role cannot be assigned through the new UI/RPC.

Platform administrator approval, organization trust, credential categories, recipient consent, immutable claims and settlement verification remain separate requirements. Any organization membership still blocks self-approval by a platform administrator, regardless of its narrower workflow capability.

## Migration and security

`202611100004_organization_teams.sql` follows Task 25. There are now 24 migration files (15 after the reported nine-file production baseline). It extends the existing role constraint, adds scoped team invitations and append-only activity, and reconciles capability checks in explicitly listed existing database functions/policies/views. Only authorization predicates change; no old facts, historical proof/hash formats or payment rules are rewritten. Legacy rows are not assigned new roles and historical team events are not invented.

All invitation writes and membership management use narrowly scoped authenticated RPCs. Tokens are 256-bit random values, hashed at rest. Raw token hashes/creator IDs have no client column grant. Verified email matching reuses Task 23's Auth check. Creation is serialized per company with a 20/day limit. Acceptance rechecks the inviter's current assignment authority; privilege reduction/removal cancels now-invalid pending invitations and audits that cancellation. Removed members fail live membership checks immediately. Membership identities are immutable; owners with unresolved payment intents cannot be removed/downgraded through management. Managers cannot mutate audit records. Private helper functions accepting arbitrary user IDs are not executable by clients.

Team names/roles are scoped to current membership; private activity and invitation management are restricted to owners/administrators. Existing credential and opportunity activity remains in its original workspace, linked from team navigation. Review authorization is organization-wide, not a new per-submission assignment system.

The server proof/wallet authorization layer checks actual role capabilities as well as database/RLS checks; existing supported wallet connection and signing/verification logic is unchanged. Authentication redirect allowlisting now recognizes only exact team invitation inbox/UUID/token routes.

## Validation and release

Commands: `bash scripts/test-organization-teams.sh`, `npm test`, `npm run test:privacy`, `npm run test:db`, lint/typecheck/format checks, and the relevant browser suites. The focused Docker script applies the full chain plus six SQL suites (team roles/invitations and five existing discovery/contact/credential suites). Fixtures are synthetic and never connect to hosted data. Browser tests cover review, role choices, responsive controls and auth handoff, not real hosted signup/email delivery.

Final counts/build outcome are recorded in delivery. The initial attention test expected only the pre-existing invitation source; it was updated to assert both recipient-only sources. No authorization/security assertion was weakened. A stray unused import warning was removed.

Production migrations, deployment and backup execution remain paused. Hosted Auth, real multi-account activity and role changes during real wallet recovery need separately authorized hosted verification. No production data, API keys, backup archives, environment changes, email or blockchain transactions are included/performed.

### Recorded local results

153 unit tests passed, 0 failed/skipped. The final selected browser run passed 38 desktop/mobile tests, 0 failed/skipped, no retries. Local REST passed 84 tests, including actual verified-email team acceptance, denied cross-account claims, scoped capabilities and removal. Focused team plus five existing workflow SQL suites passed; the full database/legacy chain also passed. Final authorization-only refinements were rechecked through the focused six-suite script. Lint, TypeScript, formatting and the ordinary production build passed. No real-device or hosted verification is claimed.

Release coordination is essential: the migration and the matching proof/wallet API role checks must ship together before inviting new scoped roles. Do not use an older broad-membership server with new roles. All work remains development-only; production release requires the separately approved backup/schema/deployment procedure.
