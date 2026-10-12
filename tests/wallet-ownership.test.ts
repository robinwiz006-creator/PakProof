import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { ownershipMessage, verifyOwnership } from "../src/lib/wallet-ownership";
test("real offline Ed25519 ownership signatures bind account, purpose, domain, and nonce", () => {
  const keys = generateKeyPairSync("ed25519");
  const der = keys.publicKey.export({ type: "spki", format: "der" });
  const wallet = getBase58Decoder().decode(der.subarray(-32));
  const v = {
    domain: "https://example.com",
    userId: "fixture-user",
    wallet,
    purpose: "account",
    organizationId: null,
    nonce: "random-nonce",
    issuedAt: "2026-10-12T00:00:00Z",
    expiresAt: "2026-10-12T00:05:00Z",
  };
  const message = ownershipMessage(v);
  const signature = sign(null, Buffer.from(message), keys.privateKey).toString(
    "base64",
  );
  assert.ok(verifyOwnership(wallet, message, signature));
  for (const change of [
    { userId: "another-account" },
    { purpose: "credential_issuer" },
    { domain: "https://attacker.example" },
    { nonce: "different-nonce" },
  ])
    assert.ok(
      !verifyOwnership(
        wallet,
        ownershipMessage({ ...v, ...change }),
        signature,
      ),
    );
  assert.ok(!verifyOwnership(wallet, message, "invalid"));
  assert.ok(!verifyOwnership("invalid", message, signature));
});
