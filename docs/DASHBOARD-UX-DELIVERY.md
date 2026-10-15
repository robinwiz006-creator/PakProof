# ProofPak dashboard journeys redesign

## Starting point and scope

Started on `fix-wallet-specific-connection` at `c1463c6`, on the same feature branch. The wallet-specific correction, earlier navigation performance work, recipient URL lookup, homepage redesign and existing MVP features are ancestors of this work. No production records, migrations, environment values, wallet code, blockchain claims or settlement rules were changed.

The previous experience offered eleven personal sidebar choices, a six-item checklist on Home, and profile editing mixed with viewing and publishing. Organization credential management displayed registration, issuance, all issued records and verification requests together. These were competing entry points rather than a clear journey.

## What users see now

### Personal navigation

Primary: Home, My Profile, Opportunities, My Activity, Credentials.

Secondary: Wallet, Payments, Account Settings. Organization dashboard remains a visible switch. Project management is linked from My Profile and the setup flow. Challenge achievements and submissions are grouped under My Activity, alongside paid applications/work. Existing URLs remain valid.

The shared sidebar also wraps signed-in opportunities and project pages. Workspace preference is a non-secret client navigation preference, never an authorization role. Authentication and server/database checks still determine access. Existing real navigation-pending indicators and loading boundaries remain.

### Personal Home

Three clear actions: Build my profile, Find opportunities, View my credentials. A short explanation keeps the Skill Passport central and wallets optional. Visibility is explicit, with a direct profile link. Home no longer fetches unrelated achievement and submission collections merely to show counters.

### Guided profile setup

1. About me: name, optional headline, introduction, location and institution.
2. My skills: optional skills; skip and return later.
3. My work and projects: existing project creation/edit/removal with evidence validation; optional before publication.
4. Preview and publish: preview link, existing URL, explicit public/private choice, copy-link action after publication.

`saveProfileStep` derives the user from the existing authenticated server context and updates only that user's row through the normal user-scoped Supabase client. `profileStepPatch` whitelists each step's fields. About cannot change visibility or identity; skills cannot overwrite biography; publishing cannot overwrite skills, projects or credentials. Visibility is not inferred from a missing checkbox. Name and URL constraints remain, with no mandatory headline, project, wallet, challenge or credential before publishing. Duplicate URL errors keep the entered values and explain how to recover.

The existing `saveProfile` and preview actions remain available for backward compatibility, but the new journey does not require marking a preview checklist complete. Existing public URLs and visibility are unchanged by default; the user can deliberately edit their URL in the publishing step, with a warning about existing shared links.

Profile viewing shows the actual passport with a compact owner toolbar. It does not show setup progress or editing forms. Organization credentials and public project/achievement evidence retain their existing consent filters.

### Organization journey

Home provides organization/credential management, an unpaid challenge action, a distinct paid-project action, review shortcuts and management links. Paid project text explicitly says test tokens, not real money. Existing challenge and milestone status/approval semantics remain.

`/organizations` now has focused sections: Overview, Issue credential, Issued credentials, Verification requests, Add organization. Overview uses counts rather than loading full credential and private-request payloads. The selected records are loaded when their section is opened. Errors remain visible and failed counts say Unavailable instead of inventing zero.

Only approved organizations appear in the issuance form. Other members see approval guidance, not self-approval controls. Organization owners can open their own selected company profile using a membership-validated URL; other members see its read-only details rather than an edit form. Server RLS remains authoritative. Administrator approval/audit controls stay in the existing gated administration area.

### Language and recovery

Dashboard headings, credential descriptions, project labels and blockchain-pending descriptions use simpler English. Organization approval, recipient consent, credential validity and blockchain integrity remain separate concepts. A recorded transaction still directs the visitor to verification; it is not relabeled independently verified.

Signup explains that one account works for personal and organization use, with an optional starting preference and no wallet requirement. Existing confirmation, login, reset and redirect security are preserved. General page errors offer a retry and a dashboard return rather than telling ordinary users to apply database migrations.

## Main source files

- `src/components/portal-nav.tsx`, `workspace-frame.tsx`; `src/lib/dashboard-navigation.ts`: navigation and workspace context.
- `src/app/layout.tsx`, `src/app/portal/[...section]/page.tsx`: shared shell and dashboard/profile/activity/organization entry points.
- `src/components/profile-setup-form.tsx`, `src/lib/profile-setup.ts`, `src/lib/actions.ts`: guided editing and per-step server saves.
- `src/lib/portal-data-needs.ts`: collection loading by page.
- `src/lib/navigation-message.ts`, `src/lib/credential-actions.ts`: query-preserving feedback redirects and returning organization actions to their appropriate sections.
- `src/app/organizations/page.tsx`: focused organization management and bounded record loading per section.
- `src/app/my-credentials/page.tsx`, `src/app/opportunities/page.tsx`, `src/app/paid-projects/page.tsx`, `src/app/sign-up/page.tsx`, `src/app/error.tsx`: next-step guidance and language.
- `src/components/credential-record.tsx`, `passport-view.tsx`, `skill-picker.tsx`, `ui.tsx`, `navigation.tsx`: clear trust labels and familiar destinations.
- `src/app/globals.css`: compact responsive task layouts, grouped navigation and setup steps.
- `tests/profile-setup.test.ts` and affected browser specs: field isolation, explicit publication, navigation, responsiveness and journey regressions.

## Security and preservation

No service-role operation is added to profile editing. The server ignores supplied user IDs, role/issuer flags and unrelated fields. No schema migration, payment settlement change, v1/v2/v3 hash change, credential acceptance change, evidence publication change, or wallet pairing change is part of this redesign. The wallet files from `c1463c6` are unchanged; no generic marketplace or unverified QR returns.

Company-profile selection is checked against actual memberships, and owner-only edit controls mirror existing backend permissions. Unauthenticated organization, credential, wallet and payment routes retain their server gates. Hidden buttons are not the security boundary.

## Validation and practical limits

Automated tests cover patch whitelists, invalid visibility/URLs, optional fields, five primary destinations, grouped legacy routes, navigation pending feedback, wallet security fixtures, credential/proof regressions and existing payment templates. Browser journeys use clearly labeled read-only demo pages and isolated fixtures, not fabricated hosted users or credentials. Local PostgreSQL tests use disposable databases, exercise RLS/workflows and preserve historical proof records.

A build or offline signature test does not prove hosted registration, actual user-session saves or real wallet behavior. These need an approved preview and founder-authorized accounts. No live user records were created or changed during this task.

## Founder acceptance walkthrough after approved preview release

1. Register a fresh personal account and follow its confirmation email. Confirm the resulting Home has the three obvious actions.
2. Open Build my profile. Save the name with optional fields empty. Verify the next step is skills and no unexpected visibility change occurs.
3. Add skills, save, and add one project with a genuine evidence link. Edit that project and confirm no duplicate record appears.
4. Skip other optional details. Preview, then explicitly choose Public and save visibility.
5. Copy the profile link and open it without login. Confirm only chosen public records/evidence appear. Switch back to Private and confirm anonymous access is blocked.
6. Repeat a skills edit on an already public profile. Confirm publishing and unrelated biography fields remain unchanged.
7. Open Opportunities, browse a challenge and submit work using a permitted demo account. Find feedback under My Activity. Open Applications & paid work for project applications and offers.
8. Accept an actual test credential and choose its publication/evidence options. Confirm acceptance alone is not shown as a verified blockchain proof.
9. Sign in as an organization owner. Check the task-based Home, organization approval status, profile editing, credential issuance and existing-record sections.
10. Use a reviewer account to confirm owner-only profile editing is absent and unauthorized writes are still denied. Check that administrator audit notes remain inaccessible.
11. Create/review a clearly labeled demo challenge and paid project through existing workflows. Confirm approval is separate from payment and from blockchain verification.
12. Open Wallet from either workspace. Confirm the selected Phantom/Solflare methods from `c1463c6` remain, with no generic QR marketplace. Real wallet/transaction testing requires separate authorization and supported methods.
13. Repeat key steps at 320px and 390px, using keyboard navigation as well as touch.

## Remaining limitations

- Real hosted email/authentication, save/publish, organization issuance and paid-work journeys require the manual preview walkthrough above.
- Wallet phone QR remains deliberately gated; this redesign does not implement or certify it.
- Some older detail and verification screens retain necessary technical identifiers, behind the existing record/verification workflow.
- Membership invitations/management and notification delivery are not added by this task.
- Existing newest-100 project discovery limits and opportunity visibility policies remain; this is not a new search backend.

## Release

Review this local feature-branch commit first. No push, merge or deployment is authorized by this task. After separate approval, push the branch, open a PR, validate an approved Vercel preview, and complete the acceptance walkthrough. There are no new migrations or required environment-variable changes.

## Validation record

Lint, TypeScript, formatting and production build passed. 52 unit tests passed. The full 64-test desktop/mobile browser suite passed; 36 affected journey/navigation/authentication/wallet checks passed when rerun after the final responsive and redirect changes. Disposable local database security/workflow tests passed, including historical-record preservation. No test used a real wallet or created hosted user data.

Local read-only demo screenshots: `/workspace/artifacts/proofpak-dashboard-journeys/`. These are not screenshots of authenticated production accounts.
