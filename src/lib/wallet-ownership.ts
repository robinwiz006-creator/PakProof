import { createPublicKey, verify } from "node:crypto";
import { getBase58Encoder } from "@solana/kit";
export type OwnershipMessage = {
  domain: string;
  userId: string;
  wallet: string;
  purpose: string;
  organizationId: string | null;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};
export function ownershipMessage(v: OwnershipMessage) {
  return [
    "ProofPak wallet ownership",
    `Website: ${v.domain}`,
    "Network: Solana devnet",
    `Account: ${v.userId}`,
    `Wallet: ${v.wallet}`,
    `Purpose: ${v.purpose}`,
    `Organization: ${v.organizationId ?? "none"}`,
    `Nonce: ${v.nonce}`,
    `Issued: ${v.issuedAt}`,
    `Expires: ${v.expiresAt}`,
    "This does not sign you in, send a transaction, or authorize a payment.",
  ].join("\n");
}
export function verifyOwnership(
  wallet: string,
  message: string,
  signatureBase64: string,
) {
  try {
    const key = getBase58Encoder().encode(wallet);
    const sig = Buffer.from(signatureBase64, "base64");
    if (key.length !== 32 || sig.length !== 64) return false;
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(key),
    ]);
    return verify(
      null,
      Buffer.from(message, "utf8"),
      createPublicKey({ key: spki, format: "der", type: "spki" }),
      sig,
    );
  } catch {
    return false;
  }
}
