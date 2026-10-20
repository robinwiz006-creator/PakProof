> Release update: [Wallet simplification](WALLET-SIMPLIFICATION-DELIVERY.md) removes phone/QR options entirely. The research below is retained as historical context.

# Wallet-specific connection correction

## Verified protocol findings

The live Reown registry was queried for the exact Phantom and Solflare records using ProofPak's public project identifier and production Origin header. Both returned `supports_wc: false` and `mobile_link: null`. Their Solana devnet chain listings do **not** establish WalletConnect support.

| Wallet | Reown/WalletConnect phone QR | Other official connection | Current result |
| --- | --- | --- | --- |
| Phantom | Not supported by its registry record | Injected extension/in-app browser; encrypted mobile deep links | No officially established desktop-to-phone QR/signing method; do not show a Phantom-branded WalletConnect QR |
| Solflare | Not supported by its registry record | Official `@solflare-wallet/sdk` and `connect.solflare.com` native service | SDK exposes message and sign-only transaction methods; direct native phone QR/devnet flow still requires service inspection and real-device verification |

Sources inspected:

- Live `https://api.web3modal.org/getWallets` records, searches `Phantom` and `Solflare`, with `st=appkit`, `sv=html-solana-1.8.24`. Do not paste the project-ID value into documentation.
- https://github.com/phantom/docs/blob/main/README.md
- https://github.com/phantom/docs/blob/main/phantom-deeplinks/provider-methods/connect.md
- https://github.com/solflare-wallet/wallet-adapter/blob/master/src/index.ts
- https://github.com/solflare-wallet/wallet-adapter/blob/master/src/adapters/iframe.ts
- Published official Solflare SDK 1.4.2 source archive (read-only inspection; not installed as a runtime dependency).

Phantom's encrypted mobile deep links are not a relay session that desktop browsers can automatically use. Reown's direct wallet/QR APIs cannot supply a protocol these wallet records do not support. Solflare's native SDK is a different integration, not WalletConnect.

## Implemented now

The user chooses Phantom or Solflare once. The method modal shows only that selected wallet's extension button and phone action. The phone action shows the selected wallet's actual availability, without opening a marketplace, listing installed extensions, initiating a download, or generating a generic QR. Back/cancel preserve the selected wallet and purpose.

Generic `connectPairedWallet` initiation is blocked for these selected wallets. Existing session recovery/disconnect and transaction-signing bridge remain available to avoid breaking previously recorded attempts. Server ownership, nonce verification, Supabase authorization, wallet uniqueness, payment settlement and devnet transaction construction are untouched.

This is a safety correction, **not a completed Solflare native QR integration**. Do not present the phone action as a working pairing method.

## Remaining blocker and next test

The cloud proxy denied `connect.solflare.com` even during an escalated read-only request. Its specific hostname has been added to the environment configuration draft while preserving prior rules. Save and publish that update, then inspect the official native flow before enabling it. We have not guessed an undocumented mobile adapter parameter or created a branded QR.

Solflare SDK source needs origin/source validation around iframe messaging before any native adapter is integrated; the published message handler inspected here does not independently validate both. An official SDK label alone is not sufficient security review.

After inspecting the actual native flow, verify: selected Solflare goes directly to its phone method, real phone approval yields the correct public key, server challenge bytes are signed unchanged, server verifies ownership, rejection/cancel/timeout do not link, and sign-only Memo/SPL transactions retain the existing devnet and settlement safeguards. Real-device approval and signing have not been tested in this cloud environment.

Automated negative phone tests verify no generic marketplace, no incompatible QR and no ownership writes. Existing offline cryptographic ownership/transaction tests do not substitute for the real device test. No hosted data, transactions, deployments or merges were performed for this correction.

## Validation of the correction

Lint, TypeScript, formatting and production build passed. 48 unit tests and 56 desktop/mobile browser tests passed. The browser tests exercise selected-wallet methods, blocked incompatible phone pairing, no ownership request on unsupported pairing, cancellation, existing offline cryptographic ownership verification and responsive layouts. Real native Solflare QR and phone signing are not tested.
