import type { Credential } from "./credentials";
import { MEMO_PROGRAM, type ChainEvidence } from "./proof";
export function credentialClaim(c: Credential) {
  return {
    version: 3 as const,
    type: "organization_credential" as const,
    credential_id: c.id,
    recipient_id: c.recipient_id,
    issuer_id: c.organization_id,
    issuer_name: c.issuer_name,
    issuer_authorization_id: c.authorization_id,
    title: c.title,
    credential_type: c.credential_type,
    description: c.description,
    issue_date: c.issue_date,
    expiry_date: c.expiry_date,
    program_name: c.program_name,
    award: c.award,
    evidence_digest: c.evidence_digest,
    created_at: new Date(c.created_at).toISOString(),
  };
}
export type CredentialClaim = ReturnType<typeof credentialClaim>;
export function serializeCredential(r: CredentialClaim) {
  return JSON.stringify({
    version: 3,
    type: "organization_credential",
    credential_id: r.credential_id,
    recipient_id: r.recipient_id,
    issuer_id: r.issuer_id,
    issuer_name: r.issuer_name,
    issuer_authorization_id: r.issuer_authorization_id,
    title: r.title,
    credential_type: r.credential_type,
    description: r.description,
    issue_date: r.issue_date,
    expiry_date: r.expiry_date,
    program_name: r.program_name,
    award: r.award,
    evidence_digest: r.evidence_digest,
    created_at: r.created_at,
  });
}
async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function credentialHash(r: CredentialClaim) {
  if (!/^[a-f0-9]{64}$/.test(r.evidence_digest))
    throw new Error("Invalid evidence digest");
  return digest(serializeCredential(r));
}
export async function credentialEvidenceDigest(e: {
  digest_salt: string;
  evidence_url: string;
}) {
  return digest(
    `[${[e.digest_salt, e.evidence_url].map((v) => JSON.stringify(v)).join(", ")}]`,
  );
}
export function credentialMemo(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid credential hash");
  return `proofpak:v3:${hash}`;
}
export function matchesCredentialAnchor(
  tx: ChainEvidence | null,
  hash: string,
  wallet: string,
) {
  return Boolean(
    tx?.meta &&
    tx.meta.err === null &&
    tx.transaction.message.accountKeys.some(
      (k) => k.signer && k.pubkey.toBase58() === wallet,
    ) &&
    tx.transaction.message.instructions.some(
      (i) =>
        i.programId.toBase58() === MEMO_PROGRAM &&
        i.parsed === credentialMemo(hash),
    ),
  );
}
