import type { Credential } from "./credentials";
import {
  credentialClaim,
  credentialHash,
  credentialEvidenceDigest,
} from "./credential-proof";
import { verificationState, type ProofState } from "./proof-status";
export type CredentialIntegrity = {
  state: ProofState;
  hash: string | null;
  evidenceMatches: boolean;
};
/** A stored signature never suffices: recompute the claim and check the real finalized transaction. */
export async function credentialIntegrity(
  c: Credential,
  check: (
    signature: string,
    hash: string,
    wallet: string,
  ) => Promise<{ valid: boolean; status?: string }>,
): Promise<CredentialIntegrity> {
  const proof = c.credential_proofs?.[0];
  let hash: string;
  let evidenceMatches: boolean;
  try {
    hash = await credentialHash(credentialClaim(c));
    evidenceMatches =
      !c.credential_evidence ||
      (await credentialEvidenceDigest(c.credential_evidence)) ===
        c.evidence_digest;
  } catch {
    return { state: "unavailable", hash: null, evidenceMatches: false };
  }
  let checked: Awaited<ReturnType<typeof check>> | undefined;
  let networkError = false;
  if (proof && proof.record_hash === hash && evidenceMatches) {
    try {
      checked = await check(proof.signature, hash, proof.issuer_wallet);
    } catch {
      networkError = true;
    }
  }
  return {
    hash,
    evidenceMatches,
    state: verificationState({
      stored: Boolean(proof),
      hashMatches: Boolean(proof?.record_hash === hash && evidenceMatches),
      checked,
      networkError,
    }),
  };
}
