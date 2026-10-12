# ProofPak redesign: Phase 0 and Phase 1 delivery

Date: 2026-10-13. Branch: `redesign-phase-0-1`. Local review only; no merge, deployment, hosted migration, production-data write, or secret change.

## Phase 0: protected foundation

Fetched current main: `98fde317cf2f8a507d6dd343b358afd908fedf05`. The previous `fix-dashboard-navigation-recipient` branch was accessible locally, with its changes still uncommitted. Those changes were saved as `cc18f69`, then the redesign branch was created from that commit. This preserves the request-scoped verified-authentication reuse, section-specific queries, persistent portal sidebar, real router pending feedback, credential URL/slug normalization, differentiated lookup errors, and regression tests.

Existing dashboard pages, forms, public passport, issuer controls, credentials, wallet ownership, proof versions, and payment workflows were inspected and retained. No authenticated dashboard redesign was started.

## Design

The homepage uses warm ivory, near black, burnt orange, sand, and light surfaces. Strong typography, numbered editorial sections, an evidence-oriented passport preview, a distinct dark paid-work section, and an orange closing section replace the old homepage. The illustrative records are explicitly labeled and contain no real credential, completed payment, or verified badge.

The requested hero and section copy is implemented. Devnet disclosures appear near the hero, in the live listings, paid-work section, and footer. Credential issuance, issuer authorization, and finalized blockchain integrity are explained separately.

Reused: `ButtonLink`, existing Next links, authentication-aware navigation, existing routes and schema, Supabase cookie/RLS context, and integer token formatting. Replaced: homepage composition and marketing-only product previews. Refined: navigation wording/destinations, footer links, and site description. New styles are scoped to the homepage/public marketing chrome; dashboard/form tokens remain unchanged.

## Live opportunities and privacy

The server component streams inside a real React Suspense boundary. Two independent queries run concurrently, returning at most three rows each. Both require `status = published` and a deadline that has not passed. Explicit columns include title, skills, deadline, company name, and paid-project public budget. No profiles, applications, accepted contracts, private submissions, wallets, credential evidence, or payment receipts are requested.

- Challenges link to `/challenges/[id]` and are labeled unpaid. There are no configured prize columns in the existing schema; no prize support was invented.
- Paid projects link to `/paid-projects/[id]`. Budgets are displayed as devnet test USDC using existing integer token formatting.
- Empty results are honest empty states. An unavailable query gets its own error state while successful results from the other query remain visible.
- Unconfigured previews contain no fabricated live listings.
- View All links to existing `/opportunities`; that page remains the existing opportunity entry point, not a new combined search feature.

Read-only public API checks against the workspace-configured Supabase project succeeded for both queries and returned zero open rows. This is not independent confirmation of the production deployment configuration, and no new opportunity records were created.

## Redesign files

Modified:

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/navigation.tsx`
- `tests/e2e/demo.spec.ts`

Added:

- `src/components/marketing-passport.tsx`
- `src/components/live-opportunities.tsx`
- `src/components/opportunity-list.tsx`
- `src/lib/live-opportunities.ts`
- `tests/live-opportunities.test.ts`
- `tests/marketing-navigation.test.ts`
- `tests/e2e/marketing.spec.ts`
- `docs/REDESIGN-PHASE-1-DELIVERY.md`

The earlier fix's additional source and regression files are preserved in ancestor commit `cc18f69`; `git show --stat cc18f69` lists them.

## Validation

- Lint, TypeScript, formatting, and production build passed.
- 35 unit tests passed, including publication filters, bounded projections, no fake fallback, unavailable/partial-error states, exact test-token budget display, correct detail links, recipient normalization, and signed-in/out navigation presentation.
- Full desktop/mobile browser suite: 36 tests passed. After final refinements, 10 affected homepage/navigation tests passed again, with a fresh production build.
- Widths: 320, 390, and 1280 pixels; no horizontal overflow in the checked layouts.
- Local disposable PostgreSQL tests passed for ownership, RLS, issuer authorization, evidence privacy, wallet controls, payment boundaries, and historical record/proof preservation. Hosted migrations were not applied.
- Screenshots inspected for desktop and mobile. Focus states and small-text contrast were reviewed; no automated accessibility audit is claimed.

Browser runs used the existing explicitly unconfigured demo test environment. Populated listing presentation/error branches use labeled automated fixtures. Signed-in navigation presentation tests do not prove a real hosted login session works.

## Review artifacts

Screenshots are saved outside the repository in `/workspace/artifacts/proofpak-redesign/`: desktop/mobile hero and full-page PNGs. These show the actual locally running application, not a design mockup. No publicly accessible browser-preview URL is claimed.

## Manual verification before any release

1. Review the actual screenshots and branch diff.
2. In a configured development or approved preview environment, confirm published real challenge/project detail links, deadlines, skills, and budgets; verify draft and expired opportunities do not appear. Do not create sample production data just for this review.
3. Sign in as an individual and an organization member; confirm header destinations, redirects, dashboard navigation, and account access. Automated browser checks did not use these real accounts.
4. Confirm full-URL recipient issuance using the earlier preserved fix, with the existing two-account workflow.
5. Review keyboard navigation and mobile menu on an actual phone, and check a slow/offline connection.
6. Obtain approval before pushing if that could trigger Vercel preview deployment, merging, or deploying. This delivery does not update production.

No new environment variables, tables, migrations, payment features, or blockchain actions are required for this redesign. Stop here after Phase 1; future public-page or dashboard redesigns are separate work.
