# ProofPak wallet pairing delivery

## Release status

A real Reown AppKit / WalletConnect Solana integration is implemented locally. It is **not yet verified as a successful laptop-to-phone wallet ownership flow**. Do not record or advertise that success until the device acceptance test below passes.

Two external requirements remain:

1. A ProofPak-owned Reown Cloud project ID, configured as `NEXT_PUBLIC_REOWN_PROJECT_ID` at build time, with the actual application origins allowed.
2. A compatible phone wallet authorizing **Solana devnet**, `solana_signMessage`, and `solana_signTransaction` in the same session.

Neither Phantom nor Solflare mobile pairing has been tested on a real device. Phantom's official documentation inspected here documents injected providers and encrypted mobile deep links; it does not establish a compatible WalletConnect devnet QR session. The application does not promise Phantom QR support. If either wallet is absent from Reown's compatible-wallet list, cannot scan a WalletConnect URI, or cannot grant the required devnet methods, that method is unsupported for the walkthrough. Do not label opening a wallet app or scanning a code as linking a wallet.

## Selected solution

Pinned Reown AppKit 1.8.24 and its Solana adapter provide the actual relay pairing URI, QR generation, wallet discovery, mobile links, and session transport. ProofPak does not generate arbitrary QR images. The SDK is loaded only when pairing or using an existing mobile session; public homepage loading does not initialize Reown.

The installed SDK source was inspected as well as official source repositories. Documentation websites were inaccessible from this cloud environment, so this is not a claim that every current mobile wallet integration has been certified.

Sources:

- https://github.com/reown-com/appkit/blob/main/examples/react-solana/src/config.ts
- https://github.com/reown-com/appkit/blob/main/packages/adapters/solana/src/providers/SolanaWalletConnectProvider.ts
- https://github.com/phantom/docs/blob/main/README.md
- https://github.com/phantom/docs/blob/main/phantom-deeplinks/provider-methods/connect.md
- https://github.com/phantom/wallet-sdk/blob/main/README.md
- https://github.com/solflare-wallet/wallet-adapter/blob/master/README.md

The published adapter contains `solana_signMessage` and sign-only `solana_signTransaction`, checks negotiated methods, and handles signature-only or serialized-transaction responses. It does not require ProofPak to switch to wallet-side broadcasting. Phantom Connect's embedded-wallet Google/Apple login is a different product and is not substituted for linking an existing Phantom wallet.

## Connection methods

| Wallet/method | Implementation | Validation |
| --- | --- | --- |
| Phantom extension / injected in-app browser | Existing Wallet Standard connection retained | Offline Wallet Standard fixture tested; real provider needs device testing |
| Solflare extension / injected in-app browser | Existing Wallet Standard connection retained | Real provider needs testing |
| Reown-compatible mobile wallet on desktop | SDK connection picker and live WalletConnect QR | Needs project ID, relay access and real device |
| Reown-compatible mobile wallet on phone | SDK wallet link where its wallet metadata supports it | Return-to-browser behavior needs real-device testing |
| Phantom mobile QR specifically | Not claimed as supported | Official compatible devnet/message/transaction pairing not established |
| Solflare mobile QR specifically | Generic supported-session path is wired, not certified for this wallet | Must pass actual session and ownership test |

A phone should use the SDK's direct wallet link where offered, not scan its own screen. If the SDK cannot provide a compatible direct link, it cannot be presented as a working mobile method. A dedicated encrypted Phantom deep-link callback flow is not implemented. We do not transfer Supabase login tokens between browsers or promise automatic login inside a different wallet browser.

## What changed

- `/wallet` first chooses purpose and organization, then opens a native accessible method dialog with Phantom extension, Solflare extension and mobile/QR connection options.
- Reown handles the real connection and QR modal. Its theme uses ProofPak's accent and ivory palette. Social login, embedded email login, analytics, swaps, onramp, send and history features are disabled.
- Pairing and signing have two-minute timeouts and clear error messages. A missing project ID produces an explicit setup error and no invented QR.
- Non-secret purpose and organization preferences survive return to the same browser through session storage. Returned organization preferences are restricted to the current user's eligible organizations; backend permissions remain authoritative.
- Every successful connection still obtains a fresh challenge from `/api/wallets`, signs its exact message, and calls the existing server signature verifier. Success is displayed only after that server call succeeds.
- A session disconnect closes Reown's session. It does not delete the database link. Saved links must still be explicitly disconnected through existing guarded controls.
- Credential v3 anchoring, historical v1/v2 achievement anchoring and milestone payments have a `Mobile / QR session` signing option.
- The bridge converts legacy transaction bytes using an explicitly pinned legacy SDK alias, because the current ProofPak SDK serializes asynchronously and Reown expects a synchronous legacy object. It verifies an unchanged transaction message and valid serialized transaction signatures, rejects account/network changes, and never broadcasts.
- Existing transaction construction, pre-broadcast payment registration, finalization checks, proof verification and settlement recovery are unchanged.
- No migration, RLS, database record, authentication setting, production secret or production deployment was changed.

## Files

- `src/lib/wallet-pairing.ts`: lazy AppKit configuration, session validation, connection/cancellation/timeout and disconnect.
- `src/lib/wallet-session.ts`: sign-only Wallet Standard-compatible bridge and timeout helper.
- `src/lib/wallet-connection.ts`: shared extension/remote provider selection.
- `src/components/wallet-manager.tsx`: method dialog, ownership flow and return intent.
- `src/components/credential-anchor.tsx`, `src/components/proof-anchor.tsx`, `src/components/milestone-payment.tsx`: remote-session provider option; existing settlement/proof logic preserved.
- `src/app/globals.css`: responsive connection-dialog styles.
- `package.json`, `package-lock.json`: pinned AppKit, adapter and legacy SDK alias.
- `.env.example`: blank public project-ID setting only.
- `playwright.config.ts`: deterministically unconfigured Reown in offline browser tests.
- `tests/wallet-session.test.ts`, `tests/e2e/wallet-pairing.spec.ts`, `tests/e2e/workspace-redesign.spec.ts`: bridge, ownership, failure, modal and return-intent regressions.

## Security boundaries

Connecting an address is not ownership. Server nonce expiry, one-time consumption, same-origin protection, authenticated user identity, cryptographic verification, uniqueness, organization membership, issuer authorization and payer-owner checks remain in the existing API and database functions.

Remote sessions must negotiate devnet and both signing methods. Session data is managed by the official SDK; ProofPak does not store wallet private keys or seed phrases. Session pairing keys are not wallet signing keys. Reown is an external network dependency and receives the metadata/addresses needed for its connection service. A project ID is public, but configure allowed origins in Reown Cloud and never place unrelated private API keys in a `NEXT_PUBLIC_` setting.

Ordinary passports need no wallet. Disconnecting a relay session is not revoking a linked wallet's database authorization. Signing never silently substitutes a different account. Unknown transaction status and payment retries retain the original existing safeguards.

## Device acceptance test: laptop and phone

Use an authorized preview or local HTTPS application configured for the real Supabase project only after normal release approval. Linking a wallet creates a database record: use dedicated founder-authorized demo accounts. No blockchain transfer is needed to test ownership.

1. Create a Reown project at https://cloud.reown.com. Use the project ID from that project, not a sample ID belonging to another application. Configure the exact preview/application origin in its allowed-origin settings.
2. Add `NEXT_PUBLIC_REOWN_PROJECT_ID` to the approved preview environment and rebuild. This is a public build-time ID. Keep all existing Supabase and devnet settings unchanged.
3. Update the phone wallet. In Phantom or Solflare, enable/select devnet where supported. Start with a personal demo account and no existing wallet link for the same purpose.
4. On the laptop sign in to ProofPak, open `/wallet`, choose Personal, then Connect and prove ownership → Connect phone wallet / QR.
5. In the Reown modal choose the mobile wallet only if it offers a compatible connection. Select its QR pairing option on desktop. The QR must represent a new SDK-generated WalletConnect session, not a website URL.
6. Scan using the wallet's supported WalletConnect scanner. Approve the actual devnet connection. If the scanner rejects the URI, the wallet is absent, or devnet is unsupported, stop: that wallet/method has not passed.
7. Approve the separate ProofPak ownership message. It must show your account, wallet, selected purpose, organization where relevant, nonce and expiry. This message sends no transaction.
8. Wait for ProofPak's server verification. Confirm the saved linked-wallet address exactly matches the phone wallet. The application must not say linked after scanning alone.
9. Reject a new signing request and verify no link is created. Try an unauthorized organization purpose and verify it cannot be linked. Existing locked links must still refuse replacement/disconnection.
10. Repeat for the second mobile wallet. Record separate results for Phantom and Solflare. Success on one does not certify the other.
11. Disconnect the pairing session. Confirm the saved link remains until explicitly removed. Reconnect using a fresh session/challenge and confirm the correct account is selected.
12. On the phone's normal browser, open `/wallet` and use the SDK's wallet link. Verify approval returns to the same authenticated browser and preserves purpose. Different-browser logins may require signing in again; do not bypass that isolation.
13. Only after separately authorizing a real transaction, test an issuer's Memo proof using `Mobile / QR session`. Confirm finalized verification independently. Then test a demo approved milestone using devnet test tokens, exact amount/recipient and the existing backend settlement verifier. Do not use mainnet or real-money USDC.

## Release steps — not executed

1. Review this branch and its limitation: real-device QR ownership has not passed yet.
2. Configure the public Reown ID and allowed preview origins; no database migration is required for this change.
3. Authorize branch push and PR creation separately. Do not merge automatically.
4. Test on an approved preview with founder-authorized demo accounts and complete the device matrix above.
5. Fix any wallet-specific incompatibility before promising support. A wallet lacking sign-only transaction capability cannot safely replace ProofPak's payment path.
6. After approval, merge to `main`; the existing Vercel Git connection may deploy automatically. Add the public project ID to the approved Production environment before its build, without changing other values.
7. Confirm Vercel's deployment status and test the final domain's permitted origin, linking, disconnect safeguards and devnet-only signing.

## Evidence and outstanding tests

Automated tests use explicit offline providers/transactions. They prove bridge compatibility and failure handling, not real QR pairing. Screenshots show the local method dialog and missing-configuration state on isolated UI fixtures. No live QR screenshot is supplied because a real project ID/session is unavailable; no mock QR was created.

Real mobile ownership, relay availability, Phantom/Solflare protocol support, QR scanning, mobile browser return, session restoration on real providers, live Memo signing and live SPL settlement remain unverified. No transaction was broadcast.

### Completed checks

- Production build, lint, TypeScript and formatting: passed.
- 47 unit tests: passed, including a production milestone transaction template signed through the bridge and accepted by the existing backend registration verifier.
- 54 Playwright desktop/mobile tests: passed using `/usr/lib/chromium/chromium`, including 320px, 390px, 768px and 1280px workspace checks, method selection, cancellation, missing configuration, unavailable extension, offline ownership and saved return intent.
- Disposable local PostgreSQL database/security/workflow and historical-data preservation tests: passed. Hosted Supabase was not accessed for writes.
- Real QR/session/device/transaction tests: not run; external requirements above remain.

Screenshots are at `/workspace/artifacts/proofpak-wallet-pairing/`. They show test-isolated method selection and the configuration blocker, not a real QR or a real linked wallet.
