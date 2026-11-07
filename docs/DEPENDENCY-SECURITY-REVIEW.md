# Dependency security investigation and targeted fixes

**Date:** 6 November 2026 (Asia/Karachi).
**Starting application:** `fix-wallet-specific-connection`, `dce33f6`.
**Scope:** dependency/lockfile changes and offline compatibility tests only. No application features, schemas, RLS, credential hashes, payment rules, hosted configuration or blockchain state changed. No push, merge or deployment.

## 1. Executive result

Two targeted dependency changes remove ten affected package entries from the fresh npm audit graph:

| Audit scope | Before: critical / high / moderate | Before total | After: critical / high / moderate | After total |
|---|---|---:|---|---:|
| Complete install | 0 / 18 / 15 | 33 | 0 / 15 / 8 | 23 |
| Production (`--omit=dev`) | 0 / 18 / 7 | 25 | 0 / 15 / 0 | 15 |

**Audit cache cross-check:** the table uses the standard-cache before/after runs for a like-for-like comparison. A final audit using the task cache returned **22 overall (14 high, 8 moderate, 0 critical)** and **14 production (14 high, 0 moderate, 0 critical)**. It omitted the propagated `@base-org/account` entry that the standard-cache report includes. Both reports agree on the remaining root advisory IDs (bigint-buffer, nested Zod, and development Minimatch). The precise cause of the propagation/metadata discrepancy was not established. It is **not** an additional code fix or proven risk reduction. Retain both results and use the outstanding root advisories for release decisions.

Low/info entries were zero in both runs. These are **affected package entries**, including propagated parent advisories, not counts of independent exploitable attacks. Audit still exits 1 because findings remain. No advisory is suppressed, no force audit fix is used, and framework security build checks remain enabled.

- Compatible patch: `follow-redirects` **1.16.1 → 1.16.2**.
- Deliberately reviewed exception to the no-major default: pinned transitive **Jayson 4.3.0 → 5.0.0**, using `overrides.jayson`. The latest 4.x is 4.3.0; 5.0.0 removes the old `stream-json` and `uuid` dependency paths while retaining the particular RPC bridge used by legacy Solana SDKs. This exception is explained and tested below.
- No Next.js, React, Supabase, Reown or Solana SDK versions were upgraded. No wallet feature was removed.
- Four now-unused transitive packages disappear because Jayson itself no longer depends on them: `stream-json` 1.9.1, `stream-chain` 2.2.5, `uuid` 8.3.2 and `eyes` 0.1.8. This is genuine dependency elimination, not audit filtering. Other modern UUID usage remains.

**Residual production risk is not resolved:** 14–15 high-severity package entries, depending on the reported propagation, trace to two remaining advisory-bearing packages: `bigint-buffer` and nested Zod 3. A currently exploitable ProofPak attack was not demonstrated. Installed affected versions and plausible SDK input paths are established; those are different claims.

## 2. How the baseline was established

Executed fresh full and production npm audits, inspected both installed manifests and lockfile nodes, used `npm ls … --all` for paths, queried registry versions/declared dependency constraints, and inspected shipped SDK source and production artifact markers. Registry metadata and npm audit were queried again after the changes; old Task 8 counts were not assumed.

Initial npm metadata queries encountered an unwritable default cache path under `/home/agent/.npm`. Subsequent metadata/install commands use a task cache under `/tmp/task10-npm-cache`. This does not change project npm configuration or suppress checks. No credentials or environment values were printed.

Clean `npm ci` subsequently succeeded from the updated lockfile, with ordinary install scripts enabled. It reported a pre-existing deprecation warning for `@safe-global/safe-gateway-typescript-sdk`; that package was not force-upgraded. The warning is maintenance information, not an additional demonstrated exploit. The dependency inventory remained narrowly changed.

### Baseline root advisories and available remediation

| Package / installed affected version | Advisory | Severity | Patched version or safe disposition |
|---|---|---|---|
| `follow-redirects` 1.16.1 | [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p): cross-realm sensitive-header arrays can be discarded across redirects | High | 1.16.2 is available and within the parent's supported range. Applied. |
| `bigint-buffer` 1.1.5 | [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg): native buffer overflow through `toBigIntLE` | High | Latest package remains 1.1.5. `@solana/buffer-layout-utils` latest 0.3.0 still declares `^1.1.5`. No compatible patched leaf identified. Retained with documented risk. |
| Nested `zod` 3.22.4 / 3.25.76 | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5): oversized constrained-collection validation can exhaust memory | High | Advisory patched line is >=4.6.6. Latest 3.x remains 3.25.76. Reown pins 3.22.4; overriding to 4 would violate that SDK contract. Root app Zod 4.6.6 is already patched. |
| `stream-json` 1.9.1 | [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x), [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc): nested-input/JSONC DoS and assembler prototype pollution | Moderate | Advisory ranges end at 3.4.0, 3.5.0 and <3.6.0 respectively. Registry latest is 3.8.0, outside the parent's 1.x contract. Instead of forcing a major parser API into Jayson 4, Jayson 5 officially removes this dependency. Removed. |
| `uuid` 8.3.2 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): missing bounds checks in v3/v5/v6 buffer use | Moderate | Patched line >=11.1.1. Jayson only used v4; Jayson 5 removes the old dependency altogether. Modern `uuid` 14.0.3 under rpc-websockets is unaffected and retained. |
| `minimatch` 10.2.6 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): globparts amplification | Moderate, development | Patched line >=11.0.1 (registry latest 11.0.5). Installed TypeScript-ESLint parent declares `^10.2.2`; registry latest typescript-estree 8.72.1 still declares that range. No blind parser/tooling major override was applied. |

### Exact important paths before remediation

```text
@reown/appkit-adapter-solana@1.8.24
  -> @reown/appkit-utils@1.8.24 -> @base-org/account@2.4.0
     -> @coinbase/cdp-sdk@1.58.0 -> axios@1.20.0 -> follow-redirects@1.16.1
     -> @coinbase/cdp-sdk@1.58.0 -> zod@3.25.76
  -> @reown/appkit-wallet@1.8.24 -> zod@3.22.4
  -> @solana/spl-token@0.4.14 -> @solana/buffer-layout-utils@0.2.0
     -> bigint-buffer@1.1.5
  -> nested @solana/web3.js@1.98.4 -> jayson@4.3.0
@solana/buffer-layout-utils -> nested @solana/web3.js@1.99.0 -> jayson@4.3.0
solana-web3-legacy (npm alias of @solana/web3.js@1.98.4)
  -> jayson@4.3.0 -> stream-json@1.9.1 / uuid@8.3.2
eslint-config-next@16.4.5 -> typescript-eslint@8.71.1
  -> @typescript-eslint/typescript-estree@8.71.1 -> minimatch@10.2.6
```

The default root `@solana/web3.js` is 3.0.2 and uses the modern Kit RPC bridge. npm groups audit entries under real package names, including aliased/nested versions. The audit entry `@solana/web3.js` below concerns legacy 1.98.4/1.99.0 nodes, not an upgrade of ProofPak's root 3.0.2 SDK.

## 3. Real application exposure

No exploit payloads were sent to production or wallets. Classification below distinguishes source-established paths from a demonstrated exploit. “Not established” is not “harmless.”

| Advisory/functionality | Source evidence and execution context | Untrusted input / artifact evidence | Assessment and action |
|---|---|---|---|
| Follow-redirects custom sensitive-header handling | Used by Axios's Node HTTP adapter through the Coinbase/Reown graph. App code does not directly import Axios or configure `sensitiveHeaders`; ProofPak's Solana RPC code uses the Solana SDK/fetch. Browser Axios adapters are different from Node redirect handling. | A configured Node SDK request following attacker-controlled redirects could reach the flaw. The default app path and sensitive-header conditions were not demonstrated. Literal `follow-redirects` markers were not found in the sampled minified production JS; missing markers do not establish tree-shaken absence. | Installed vulnerable code confirmed; actual application exploit not established. Compatible patch applied without changing headers, providers or app requests. |
| Bigint-buffer native integer conversion | `@solana/buffer-layout-utils/lib/cjs/bigint.js` calls `toBigIntLE(Buffer.from(src))` for decoded layouts. Browser implementation uses JavaScript; native Node implementation tries `bindings('bigint_buffer')`, falling back to JS. | SDK account bytes can originate from RPC; exact variable-length attacker data reaching the vulnerable native converter was not demonstrated. `toBigIntLE` appeared in one browser and one server compiled artifact before changes. Server source maps also include `node_modules/bigint-buffer/dist/node.js`. No `.node` binding was found in this local install, but another build/deployment may compile one. | Potential SDK/native reachability; no demonstrated ProofPak overflow. Browser JS does not execute the Node native binding, but that is not a global safety claim. No patched leaf or safe compatible parent removal found. Retained. |
| Nested Zod 3 collection validation | `@reown/appkit-wallet/dist/esm/src/W3mFrame.js` calls `W3mFrameSchema.*.safeParse(data)` on SDK frame messages. Schemas contain arrays. Coinbase SDK also retains Zod 3. | Third-party/frame/provider data is an untrusted boundary if the corresponding SDK features initialize. Whether the advisory's exact constrained collection path is activated with ProofPak's disabled email/social/onramp features is not established. Decoded server source maps explicitly include `node_modules/@reown/appkit-wallet/node_modules/zod/lib/index.mjs` (installed 3.22.4) and `W3mFrameSchema.ts`. Generic Zod markers also occur in browser chunks, and the Zod 3 diagnostic string `Invalid discriminator value` appears in two client chunks. These are artifact-inclusion indicators, not proof of active listeners on the default wallet page. Coinbase's nested Zod was not identified in the built source maps; installation alone is not evidence of execution. | Potential legacy SDK exposure, not a proven app memory-exhaustion exploit. App forms use patched root Zod 4.6.6. Do not force a Zod major into SDK internals. Retained pending upstream-compatible remediation. |
| Stream-json parsing/filter/assembler | Legacy Solana imports `jayson/lib/client/browser`; that client JSON-parses RPC responses. Jayson 4's Node utility module additionally imported stream-json server/stream helpers. ProofPak does not expose a Jayson HTTP/TCP server. | RPC response bodies are untrusted in principle. The specific stream filters/JSONC/assembler paths were not demonstrated in the app's default RPC flow, and the browser client did not import the stream parser directly. | Installed affected parser removed by upstream Jayson 5, avoiding forced parser API substitution. Reduced installed attack surface, not evidence that a production exploit was stopped. |
| UUID legacy bounds checks | Jayson 4 imported only `uuid.v4` in request generation and browser client; vulnerable report concerns v3/v5/v6 buffer arguments. | No use of the vulnerable UUID functions found in ProofPak or the inspected Jayson RPC caller. Other hidden library uses were not exhaustively proved impossible. | Specific exploit path not established. Jayson 5 removes old UUID and preserves random v4-style RPC IDs using Web Crypto. No credential IDs/hashes depend on that implementation. |
| Minimatch tooling amplification | Used by TypeScript-ESLint glob processing in lint/parser tools. Not present in the production-omitted audit. | Repository/file-pattern inputs in the development/build pipeline; no public application endpoint using this dependency was found. | Development risk retained and reported. Supported upstream range still excludes the patched major; do not churn ESLint/Next or force unsupported glob behavior to improve counts. |

### Wallet surface retained

`src/lib/wallet-connection.ts` dynamically imports `wallet-pairing.ts` only for the existing remote-session branch. Supported Phantom/Solflare extension/in-app-browser ownership linking remains separate. `wallet-pairing.ts` still imports AppKit/SolanaAdapter and checks real session capabilities; unsupported QR flows stay blocked.

Reown packages are therefore **not genuinely unused** in the current product. Removing them would delete existing-session signing/recovery/disconnection functionality and needs an explicit product/migration decision plus real-wallet acceptance. This task preserves it rather than disguising removal as dependency cleanup. Reown registry latest remains 1.8.24 during this review.

The `toBigIntLE` artifact marker shows why declaring all remaining legacy code absent would be wrong. Artifact marker scans are supporting evidence only: a string match is not proof of execution, and a missing package-name string in minified output is not proof of exclusion.

## 4. Changes and justification

### Compatible follow-redirects patch

Updated the lockfile to 1.16.2 through the existing parent's compatible dependency range. No override is required. The patched code uses `Array.isArray(options.sensitiveHeaders)` rather than the cross-realm-sensitive check described by the advisory. No application configuration or transport rule changed.

### Carefully bounded Jayson major override

`package.json` now has:

```json
"overrides": {
  "jayson": "5.0.0"
}
```

This is intentionally out of the legacy SDK parents' declared `^4.1.1`/`^4.3.0` ranges. It is **not** being presented as a routine compatible minor update. The exception is justified by:

1. Latest 4.x remains 4.3.0 and retains the affected leaf dependencies. Jayson 5 removes them upstream; no application parser shim or vulnerable package replacement is invented.
2. Source inspection confirms legacy Solana uses the same `jayson/lib/client/browser` constructor, `request` and batch callback interface retained in 5.0.0. The package path and CommonJS/type exports remain available.
3. Version 5 requires Node >=20, below ProofPak's existing required Node >=24.19.0 <25. Request IDs use `crypto.randomUUID()` or `getRandomValues` fallback. Supported browser wallet usage already requires modern cryptography and hosted HTTPS.
4. Three new offline tests execute actual `Connection` clients: the direct legacy alias, Reown's nested 1.98.4 SDK and buffer-layout-utils' nested 1.99.0 SDK. They cover generated IDs, multiple requests, finalized parameters, JSON-parsed transaction requests, batch callbacks, null history and propagated RPC errors. All network transport is intercepted; no Solana service is contacted.
5. Existing wallet-message, transaction serialization, bridge signing, proof and exact-payment verifier tests still pass. Production and browser builds validate bundler resolution.

The override applies to all current Jayson consumers, which are these inspected legacy Solana SDK nodes; it is not a global UUID/Zod/parser override. Keep the exact pin and regression tests until supported upstream parents adopt the fixed dependency. Any future SDK upgrade must re-review this override and remove it when the upstream contract safely permits.

### Versions deliberately unchanged

Next.js/eslint-config-next 16.4.5, React 19.3.0, Supabase, root Solana web3 3.0.2/Kit, legacy SDK 1.98.4, nested SDK 1.99.0, Reown 1.8.24, and root Zod 4.6.6 remain unchanged. No database migration, proof serializer, wallet purpose rule, mint, token decimals, amount calculation, settlement predicate or application route changed.

## 5. What the audit reduction means

- Compatible redirect handling is patched in the installed graph.
- The vulnerable stream parser and old UUID implementation are removed from that graph, along with propagated parent findings. Five root advisory IDs disappear: one follow-redirects advisory, three stream-json advisories and the UUID advisory.
- This is a real dependency/code-surface change, but not five proved production exploits prevented. In particular, inspected UUID callers used v4, not the reported vulnerable functions.
- The standard-cache report’s remaining 15 production entries (14 in the task-cache run) are all high severity and propagate from **two root advisory-bearing packages**, not 15 distinct ProofPak exploits. Do not describe the release as vulnerability-free.
- Eight moderate development entries remain through the Minimatch/TypeScript-ESLint path. They were not hidden with audit-level filters.

### Remaining remediation and mitigation

- Track an upstream-compatible Reown wallet SDK release using patched validation dependencies. Before retiring legacy session support, explicitly decide how existing-session users and wallet recovery will migrate; do not silently remove it.
- Request a patched integer-layout dependency from the Solana adapter ecosystem or design/test a compatible replacement in a separate task. Updating buffer-layout-utils to 0.3.0 alone still leaves bigint-buffer 1.1.5 and would not solve this finding.
- Preserve current server-side bounds, devnet checks, strict transaction validation and optional-wallet design. These reduce exposure in known application paths but do not remove the installed advisories.
- Monitor TypeScript-ESLint's supported Minimatch range and use a supported fix when available. Review untrusted pull requests/build inputs as development supply-chain input.
- Physical Phantom/Solflare and legacy remote-session behavior still requires preview/device testing. Do not infer wallet approval success from a green build.

## 6. Validation and release

A clean `npm ci` succeeded with the updated lockfile. Exact final checks and post-test audit results are recorded below after completion. No tests contact a real Solana account or broadcast a transaction. Disposable database/REST suites use synthetic accounts, not the production Supabase environment.

This task adds only the security override, lockfile changes, `tests/dependency-rpc.test.ts` and this report. Existing untracked integration/preview/product-audit documents are left untouched. No secrets or environment files are included.

Release prerequisites: review the override, run an authorized preview built with `npm ci`, verify the expected package versions/runtime, and perform separate real-wallet connection/message/Memo/test-token acceptance checks before production approval. Existing unapplied application migrations from prior tasks remain separate release prerequisites; this dependency task adds none. No new environment variables are required.

If the override causes an unforeseen compatibility issue, stop the release and revert the focused dependency commit or prepare a reviewed repair. Do not bypass strict payment verification or change historical proof formats to accommodate an SDK. Removing the override without another remediation reintroduces its audit findings.

**Recommended next task:** resolve the remaining legacy wallet dependency exposure through an upstream-compatible SDK update or an explicitly approved legacy-session migration plan, then run real-device preview acceptance. Keep payment/proof recovery fixes from the integration audit on the roadmap; no new product feature is needed to complete this security work.

## Appendix: complete initial affected-package inventory

The table records the fresh audit graph, including propagated entries. Direct refers to npm's audit classification; aliased SDK nodes are grouped under their actual package name. Parent rows inherit the advisory through the listed dependency and are not additional independent advisories.

| Package (npm audit name) | Installed affected version(s) before | Severity | Direct entry? | Advisory source / propagated dependency |
|---|---|---|---|---|
| `@base-org/account` | 2.4.0 | high | Transitive | @coinbase/cdp-sdk |
| `@coinbase/cdp-sdk` | 1.58.0 | high | Transitive | abitype, axios, axios-retry, zod |
| `@reown/appkit` | 1.8.24 | high | Yes | @reown/appkit-controllers, @reown/appkit-pay, @reown/appkit-scaffold-ui, @reown/appkit-ui, @reown/appkit-utils, @reown/appkit-wallet |
| `@reown/appkit-adapter-solana` | 1.8.24 | high | Yes | @reown/appkit, @reown/appkit-controllers, @reown/appkit-utils, @reown/appkit-wallet, @solana/spl-token, @solana/wallet-adapter-base, @solana/web3.js |
| `@reown/appkit-controllers` | 1.8.24 | high | Transitive | @reown/appkit-wallet |
| `@reown/appkit-pay` | 1.8.24 | high | Transitive | @reown/appkit-controllers, @reown/appkit-ui, @reown/appkit-utils |
| `@reown/appkit-scaffold-ui` | 1.8.24 | high | Transitive | @reown/appkit-controllers, @reown/appkit-pay, @reown/appkit-ui, @reown/appkit-utils, @reown/appkit-wallet |
| `@reown/appkit-ui` | 1.8.24 | high | Transitive | @reown/appkit-controllers, @reown/appkit-wallet |
| `@reown/appkit-utils` | 1.8.24 | high | Transitive | @base-org/account, @reown/appkit-controllers, @reown/appkit-wallet |
| `@reown/appkit-wallet` | 1.8.24 | high | Transitive | zod |
| `@solana/buffer-layout-utils` | 0.2.0 | high | Transitive | @solana/web3.js, bigint-buffer |
| `@solana/spl-token` | 0.4.14 | high | Transitive | @solana/buffer-layout-utils, @solana/spl-token-group, @solana/spl-token-metadata, @solana/web3.js |
| `@solana/spl-token-group` | 0.0.7 | moderate | Transitive | @solana/web3.js |
| `@solana/spl-token-metadata` | 0.1.6 | moderate | Transitive | @solana/web3.js |
| `@solana/wallet-adapter-base` | 0.9.27 | moderate | Transitive | @solana/web3.js |
| `@solana/web3.js` | 1.98.4, 1.99.0 | moderate | Yes | jayson |
| `@typescript-eslint/eslint-plugin` | 8.71.1 | moderate | Transitive | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils |
| `@typescript-eslint/parser` | 8.71.1 | moderate | Transitive | @typescript-eslint/typescript-estree |
| `@typescript-eslint/type-utils` | 8.71.1 | moderate | Transitive | @typescript-eslint/typescript-estree, @typescript-eslint/utils |
| `@typescript-eslint/typescript-estree` | 8.71.1 | moderate | Transitive | minimatch |
| `@typescript-eslint/utils` | 8.71.1 | moderate | Transitive | @typescript-eslint/typescript-estree |
| `abitype` | 1.0.6 | high | Transitive | zod |
| `axios` | 1.20.0 | high | Transitive | follow-redirects |
| `axios-retry` | 4.5.0 | high | Transitive | axios |
| `bigint-buffer` | 1.1.5 | high | Transitive | GHSA-3gc7-fjrx-p6mg |
| `eslint-config-next` | 16.4.5 | moderate | Yes | typescript-eslint |
| `follow-redirects` | 1.16.1 | high | Transitive | GHSA-mrwp-f3q8-3g9p |
| `jayson` | 4.3.0 | moderate | Transitive | stream-json, uuid |
| `minimatch` | 10.2.6 | moderate | Transitive | GHSA-g3hv-75wg-m249 |
| `stream-json` | 1.9.1 | moderate | Transitive | GHSA-528h-pc64-c93x, GHSA-hqr4-qq8f-hg3x, GHSA-mjw6-4jj6-33hc |
| `typescript-eslint` | 8.71.1 | moderate | Transitive | @typescript-eslint/eslint-plugin, @typescript-eslint/parser, @typescript-eslint/typescript-estree, @typescript-eslint/utils |
| `uuid` | 8.3.2 | moderate | Transitive | GHSA-w5hq-g745-h8pq |
| `zod` | 3.22.4, 3.25.76 | high | Transitive | GHSA-mrhx-c7xc-m3w5 |

## Final validation and final re-audit

| Command/check | Passed | Failed | Skipped |
|---|---:|---:|---:|
| `npm test` | 78 | 0 | 0 |
| `npm run test` | 78 | 0 | 0 |
| Direct REST security tests | 43 | 0 | 0 |
| Disposable database workflow/upgrade suites | 12 | 0 | 0 |
| Browser tests (desktop/mobile) | 152 | 0 | 0 |

The two unit commands are aliases for the **same 78-test suite**, run separately as requested—not 156 distinct tests. Three new RPC compatibility tests were added. Browser tests ran with one worker, passed on the first run (approximately 7.7 minutes), and required no retries. No assertions or security checks were disabled. Database counts are suites rather than individual SQL assertions. Expected migration-drift rejection probes passed as negative checks.

`npm ci`, lint, TypeScript, formatting, `git diff --check`, and the production build passed. The build retained the normal security guard and completed without `SecurityFatalError`. Full and production audits were repeated after installation/validation and confirmed **23 total (15 high, 8 moderate, 0 critical)** and **15 production (15 high, 0 moderate, 0 critical)** respectively with the standard cache. The independent task-cache results are **22 total / 14 production** as explained above. Their exit status 1 is expected because findings remain; it is not a clean security audit.

These checks include offline Ed25519 ownership, real transaction encoding/signing on synthetic keys, legacy bridge signing, strict devnet payment verifier fixtures, credential privacy and historical v1/v2/v3 compatibility. They do not prove hosted Auth, physical Phantom/Solflare approvals, Reown mobile sessions, live RPC availability, real devnet settlement or production readiness. No real chain transactions were sent.

The remaining production root advisories are still **GHSA-3gc7-fjrx-p6mg** (`bigint-buffer`) and **GHSA-mrhx-c7xc-m3w5** (nested Zod 3); the remaining development root advisory is **GHSA-g3hv-75wg-m249** (Minimatch). Parent package entries inherit those findings. Treat their upstream remediation/exposure review as release risk, not as resolved by the smaller audit count.
