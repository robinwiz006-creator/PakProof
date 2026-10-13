import test from "node:test";
import assert from "node:assert/strict";
import { requirePhonePairingSupport } from "../src/lib/wallet-phone-support";
test("unverified selected-wallet phone protocols fail closed before creating a session", () => {
  for (const wallet of ["Phantom", "Solflare"] as const)
    assert.throws(
      () => requirePhonePairingSupport(wallet),
      /does not support.*WalletConnect/,
    );
});
