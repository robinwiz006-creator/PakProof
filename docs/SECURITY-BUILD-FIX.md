# P0.1 — Next.js security build fix

Date: 5 November 2026. Branch: `fix-wallet-specific-connection`, based on `e40ce26`.

## Result and scope

The normal production build now finishes with exit code 0 on Next.js 16.4.5, without `SecurityFatalError`. No security guard, audit check, runtime flag, or deployment configuration was disabled to obtain that result.

This task changes only the framework dependency versions, their npm lockfile entries, and this delivery note. It does not implement other audit recommendations. The pre-existing, untracked `docs/PROOFPAK_PRODUCT_AUDIT.md` is preserved and intentionally excluded from the focused security commit.

## Root cause

Next.js 16.4.0 was within three vulnerable ranges returned by the npm security advisory service. Its build-time security check stopped the command after compilation and route generation. This was a security-policy halt, not a Supabase migration failure or TypeScript compilation error.

The fresh registry advisory response identifies these affected Next.js ranges as `>=16.0.0 <=16.4.0`:

| Advisory | Reported issue |
| --- | --- |
| [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | Critical: SVG image-optimization remote code execution |
| [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | Critical: remote code execution involving typed arrays returned from `use cache` functions |
| [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | High: App Router Server Actions denial of service |

The upgrade removes Next.js from the fresh npm audit report. No exploit was attempted; this is evidence that the installed version is outside those reported affected ranges, not a comprehensive penetration test.

## Minimum dependency changes

| Dependency | Before | After | Reason |
| --- | --- | --- | --- |
| `next` | 16.4.0 | **16.4.5** | Patched release in the same minor series; outside the returned vulnerable ranges. |
| `eslint-config-next` | 16.4.0 | **16.4.5** | Keep the framework's lint integration on the matching patch version. |
| `react` | 19.3.0 | **19.3.0, unchanged** | Satisfies Next.js 16.4.5's React peer range; no React advisory returned in the fresh framework query. |
| `react-dom` | 19.3.0 | **19.3.0, unchanged** | Remains paired with React; no security-driven change needed for this fix. |

Next.js 16.4.5 accepts Node >=20.9.0, compatible with this repository's Node 24 engine. Its React peer range includes the existing 19.3.0 pair. `eslint-config-next` accepts the installed ESLint 9 and TypeScript 5.

Installed with ordinary npm exact-version installation, not `npm audit fix --force`, overrides, legacy-peer-dependency bypasses or security suppression. The lockfile preserves all unrelated package versions. Twelve versioned package entries changed: Next.js, eslint-config-next, @next/env, the Next ESLint plugin and eight platform-specific SWC packages. npm also refreshed some existing resolution/integrity metadata.

Supabase, Reown, Wallet Standard, Solana SDKs, validation libraries and transaction libraries retain their existing locked versions.

## Validation

| Command | Result | Passing | Failing | Skipped |
| --- | --- | --- | --- | --- |
| `npm run lint` | Exit 0 | No lint errors reported | 0 errors | N/A |
| `npm run typecheck` | Exit 0 | No TypeScript errors | 0 errors | N/A |
| `npm test` | Passed | 60 | 0 | 0 |
| `npm run test` | Passed | 60 | 0 | 0 |
| `npm run format:check` | Passed | All matched files conform | 0 | N/A |
| `npm run build` | **Exit 0; no security halt** | Production compilation, TypeScript and page generation completed | 0 build failures | N/A |
| Existing browser suite (`npm run test:e2e`) | Passed; fresh isolated build and server | 126 (63 desktop, 63 mobile) | 0 | 0 |

`npm test` and `npm run test` run the same 60 distinct tests twice, as requested. They are not 120 different tests.

Browser invocation uses the repository's existing configuration and command:

```bash
NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

The localhost proxy exception prevents the execution environment's outbound proxy from intercepting the local test server. It is transient, does not disable the security check, and does not change production environment variables. The existing browser runner performs a fresh build before starting its isolated server. No external temporary runner config, reused pre-upgrade build, or guard bypass is used for this task.

The runner clears Supabase/service-role/Reown/cron values for its test server. Browser tests therefore cover local UI, route guards, offline fixtures and mocked wallet providers, not actual hosted authentication, physical wallets or live settlement.

Database migrations and `npm run test:db` were **not run** in this task. SQL files are unchanged; this task does not authorize migrations or database changes.

## Compatibility preserved

- No changes under `src/`, `supabase/`, or `scripts/`.
- No changes to `next.config.ts`, `vercel.json`, browser configuration, authentication settings, or environment files.
- Supabase authentication/session code and server actions/route handlers remain unchanged; compilation, type checks and existing browser route/authorization regressions validate local framework compatibility.
- Unit coverage includes deterministic v1/v2/v3 claims, historical verification rules, wallet ownership signatures, integer token amounts, transaction serialization/validation and duplicate-settlement protections.
- Wallet/chain SDK versions are unchanged. No credential serialization, hash field, payment verifier, mint, network or historical proof format was edited.
- No real wallet was used and no transaction was broadcast. Automated cryptographic tests use offline generated keys and fixtures. No hosted database record or production setting was changed.

Real confirmation emails, Supabase session refresh on the preview domain, real Phantom/Solflare signing, live proof RPC verification and devnet settlement still require an explicitly authorized preview walkthrough. Local regression success is not a claim these were tested in production.

## Remaining advisories: not all resolved

Fresh same-task scans:

| Audit | Total affected package entries | Critical | High | Moderate |
| --- | --- | --- | --- | --- |
| Before fix, all dependencies | 31 | 1 | 15 | 15 |
| After fix, all dependencies | 30 | **0** | 15 | 15 |
| After fix, `--omit=dev` | 22 | **0** | 15 | 7 |

These are npm's aggregated dependency entries; shared/transitive chains can be counted more than once. The Next.js entry contained all three framework advisories. Counts come from fresh before/after scans, rather than the earlier product-audit snapshot. Both post-fix audit commands still return exit code 1 because other findings remain.

### Production dependency findings

Remaining production entries include the Reown/AppKit/adapter and Coinbase chains, `bigint-buffer`, transitive `follow-redirects`, nested Zod, `stream-json`, `uuid`, and legacy Solana web3.js/`jayson` chains.

They cannot all be dismissed as development-only:

- `src/lib/wallet-connection.ts` can dynamically import `src/lib/wallet-pairing.ts` for an existing signing session; that module imports Reown and its Solana adapter.
- `src/lib/wallet-session.ts` imports `solana-web3-legacy` for transaction compatibility.
- AppKit and legacy SDK functionality therefore remain potential runtime paths, even though generic QR pairing is absent from the primary wallet page.
- The reported Zod findings are nested under Coinbase/Reown; the root application's Zod 4.6.6 is not the same installation.
- The reported web3.js finding points to legacy/nested copies, not evidence that the root 3.0.2 installation is the affected copy.

Examples of underlying advisories still reported include buffer overflow in `bigint-buffer` ([GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg)), cross-realm credential-header handling in `follow-redirects` ([GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p)), constrained-collection memory exhaustion in nested Zod ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)), and several `stream-json`/`uuid` findings.

Installed affected dependencies are not proof that their exact vulnerable functions are reachable from an unauthenticated ProofPak request. This task has not established that reachability, examined the actual deployed Vercel bundles, or performed a penetration test. **They remain a real follow-up security concern, not a resolved or proven-harmless set of findings.** Changing/removing wallet SDK trees or forcing transitive upgrades is outside this focused Next.js build fix.

### Tooling findings

Eight additional moderate entries occur only in the full dependency audit: the ESLint/TypeScript-ESLint/minimatch chain, including the newly matched eslint-config-next through its transitive dependencies. No ordinary application import of this lint tooling was found. They concern development/CI tooling rather than demonstrated normal request paths; exact deployed bundle contents were not inspected.

## Preview/release status

The framework build blocker is resolved locally and the change can proceed to a **controlled preview deployment for acceptance testing**, with all 126 browser cases now passing. This is not approval to merge or deploy production, and not clearance of every product-audit/security finding.

No environment-variable or database migration change is required for this patch. Keep existing preview authentication redirects, server-only keys and devnet restrictions. Review remaining runtime advisories separately before making a broad production-security claim.

Only package.json, package-lock.json and this focused note belong in the security commit. Do not include the pre-existing audit document or unrelated files by accident.
