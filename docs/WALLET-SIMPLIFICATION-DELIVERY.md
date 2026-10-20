# Wallet simplification

## Release behavior

- `/wallet` is now **My Wallet**, with linked records first, then a compact connection section.
- Connect Wallet → choose Phantom or Solflare once → connect that exact Wallet Standard provider → sign the existing server-issued nonce message → wait for server confirmation.
- No desktop phone connection button, QR availability screen, generic wallet marketplace, QR image, or automatic installation redirect.
- If detection fails, show the selected wallet's official download link and a retry action. Detection is not proof of ownership. Locked/rejected requests do not produce verified state.
- Mobile users can use the selected wallet's supported in-app browser and the same provider/message flow. Physical-device compatibility is not established by a browser fixture.
- Personal is the default. Old session-storage organization preferences no longer override it. Explicit organization entry links carry purpose and organization; the server limits choices to current membership/role/approval. Payment signing and credential signing remain separate roles.
- Linked-wallet rows display real server records, purpose, address, ownership status, copy action, devnet Explorer link and secondary details. No balance is invented.
- Browser session disconnection is distinct from account unlinking. Unlink still uses the existing confirmation and authorized `disconnect_wallet` function. Existing active-agreement/payment guards and historical signatures remain unchanged.

## Dependency audit

Reown/AppKit is no longer imported by wallet management. Its lazy legacy signing bridge is still referenced by `wallet-connection.ts`, used by credential/achievement anchoring and milestone signing. Retaining those packages avoids removing recovery for existing signing sessions. No code opens its marketplace. The legacy selector label is **Existing signing session**, not an advertised QR connection.

`NEXT_PUBLIC_REOWN_PROJECT_ID` is not required for new Phantom/Solflare extension or supported in-app-browser ownership connections. It remains relevant only to the retained legacy session path. No new environment variable or migration is required. Existing `/api/wallets` Supabase server configuration is unchanged.

## Security boundaries

No changes to wallet ownership API, signed-message validation, service-role use, RLS, permission checks, unlink RPCs, transaction construction, settlement or v1/v2/v3 integrity verification. The wallet page now selects only presentation columns rather than retrieving stored ownership signatures. Organization context never grants permission: existing server/database checks remain authoritative.

Test-only linked records and provider doubles live in the existing gated `/test-ui` fixture, unavailable with configured Supabase. Offline signature tests use freshly generated keys and intercepted HTTP routes. They are not production wallet approvals or real blockchain transactions.

## Manual checks before release

1. With each real extension installed, unlock it, select it once and approve connection/message signing. Confirm the linked row appears after the real server verifies ownership.
2. With both installed, confirm only the selected wallet prompts. With neither installed, confirm only the chosen wallet's official install link appears. Install/enable it and retry.
3. Reject connection, reject message signing, lock and disconnect the extension; confirm recovery is clear and no new link appears without server confirmation.
4. Open ProofPak in each supported mobile wallet browser, sign in and repeat ownership linking. Mobile-layout fixtures cannot establish physical-wallet compatibility.
5. Check Personal defaults and both organization roles with owner/member/unrelated accounts. Existing duplicate/permission/expiry rules must still reject invalid requests.
6. Inspect existing linked records; copy address, open Explorer and test browser disconnection. Test actual unlink only with an authorized demo account, including a wallet locked by work/payment.
7. Separately authorize any later real devnet credential/payment transaction test. Connecting itself sends none.

No production data, settings, deployments or migrations were changed for this task.

## Validation evidence

- Production build completed successfully using `npm run build`.
- 52 unit tests passed, including real offline Ed25519 ownership verification, devnet-only signing, historical proof versions and SPL settlement fixtures.
- `npm run test:db` passed against disposable local PostgreSQL, including replay rejection, owner-only unlink, payment locks, private records, and legacy-record preservation. No hosted database was used.
- Browser checks use installed Chromium with desktop and emulated mobile projects. A temporary configuration outside the repository extends cold-build startup to five minutes. The full run passed all wallet-specific tests; four broader mobile tests reached the default 30-second limit and were rerun serially with 60 seconds. Final results are recorded below.
- Offline wallet providers and intercepted ownership responses are explicitly fixtures. Hosted Supabase account linking, actual extension approval, physical in-app browsers, actual unlink and real devnet transactions still need authorized manual testing.
- Screenshot artifacts under `/workspace/artifacts/proofpak-wallet-simplification` show offline component fixtures, not production accounts.

Final results: lint, TypeScript and formatting passed. Full browser run: 76 passed and 4 timed out; all four passed on the serial retry (49.3 seconds total). Thus every one of the 80 browser cases passed across those runs, but the original full run was not a clean one-shot pass. No browser assertions were removed or disabled. All wallet-specific cases passed in the full run. The startup timeout and serial retry were local runner overrides, not application/security changes.
