# Focused UX simplification

Branch: `fix-wallet-specific-connection`. Builds directly on `3ccb99b` and preserves wallet commit `6ccef15`. This is a local-only release; nothing has been pushed, merged or deployed.

## Changes

- `/opportunities`: real published cards, search by title/organization/skills/summary, All / Challenges / Paid Projects filters, exact test-token budgets, deadlines, short descriptions and direct detail links. Empty, failed and partially failed queries are distinct. No fabricated fallback listings. The current challenge schema has no prize field; these challenges are labeled unpaid.
- `/paid-projects/[id]`: concise project brief, budget/deadline/status, separate scope and skills, readable milestone amounts and deliverables. Apply opens a keyboard-accessible native dialog instead of displaying the full form immediately. Existing applicants, organization members, visitors and closed opportunities have appropriate alternative states. Long descriptions and frozen offer terms remain available through expandable sections; pending offers show their terms initially.
- `/how-it-works`: three short steps, a primary passport signup action, an organization path and expandable Trust & Verification details. The devnet, optional-wallet, privacy, issuer-identity and blockchain-integrity limitations remain accurate.
- Focused wording improvements on paid-project listings, Payments and Organizations. Existing homepage, wallet and credential redesigns are retained.

## Data and security

Discovery performs two parallel, explicitly projected public queries, bounded to 100 newest published, non-expired opportunities per type. The homepage keeps its original limit of three per type. Search is local to this bounded result set and is labeled accordingly. Only public discovery fields enter the client component; private contracts, applicants, wallets and evidence are excluded.

Application fields and server action are unchanged. UI eligibility is guidance, not authorization: database permissions remain authoritative. Accepted terms, settlement verification and wallet ownership security are unchanged. No database migrations, dependency changes, production data changes or environment changes.

## Verification

Lint, TypeScript, formatting and all 60 unit tests passed. The production build passed, including a fresh production build for the browser suite after the final UI edits. All six local database suites passed: paid-project workflow, payment trust boundary, original challenge workflow, organization credentials, wallet ownership, and migration preservation. All 112 browser tests passed (56 desktop, 56 mobile), including 16 new opportunity/application/How It Works cases. The suite required no failed-test retries. Tests used a temporary 90-second per-test allowance and 300-second server startup allowance for this cloud workspace; no repository test timeouts were changed. Browser fixtures are explicitly labeled offline examples, available only through the existing E2E-gated test route with Supabase unconfigured. They are never fallback production opportunities.

New automated coverage includes opportunity query projections and bounds, search/filtering, private-field exclusion, integer budgets, application eligibility, browser empty/error states, Apply dialog validation/cancellation, and layouts at 320px, 390px and 1280px. Local database tests cover anonymous/self-company/invalid/duplicate applications alongside existing workflow and privacy tests.

## Manual acceptance still required

1. On a preview deployment, open Opportunities signed out and signed in; compare the visible published opportunities with authorized database records. Test search, type filters and detail links.
2. As a real individual, apply to a published project with a valid approach and evidence URL; confirm success, the existing application status, and organization visibility. Confirm another individual cannot view the application.
3. As the project organization, confirm applying to its own project is unavailable; review selection, terms acceptance, milestone submission and review. This change does not alter these server actions.
4. Check the same journeys on actual mobile devices, including dialog focus, keyboard, closing and scrolling. Automated Chromium mobile emulation is not a physical-device test.
5. Ask a first-time user to explain the next action within five seconds on each changed main page. This usability goal requires human testing.
6. Existing authenticated production, real-wallet signatures and Solana transactions have not been exercised during this change. No transaction has been sent.

No Supabase migration or environment configuration is required for these changes. Release only after review and separate approval to push/merge/deploy.

## Review screenshots

These are local artifacts, not production screenshots:

- `/tmp/proofpak-ux-review/opportunity-ux-1280-desktop.png`: shared discovery and project components, clearly labeled fixture data.
- `/tmp/proofpak-ux-review/opportunity-ux-390-desktop.png`: 390px shared components.
- `/tmp/proofpak-ux-review/application-dialog-390-desktop.png`: application dialog.
- `/tmp/proofpak-ux-review/how-it-works-desktop.png`: actual public How It Works route.
- `/tmp/proofpak-ux-review/how-it-works-mobile.png`: actual route at 320px.

Browser execution uses Chromium desktop and mobile emulation. A temporary external config provides additional runtime allowance for this cloud workspace; repository runner settings are unchanged.
