import type { Credential } from "./credentials";
import type { ProofState } from "./proof-status";
export type CredentialRecipient = {
  full_name: string;
  slug: string;
  is_public: boolean;
};
export function canShareCredential(
  c: Credential,
  recipient: CredentialRecipient | null,
) {
  return Boolean(
    c.credential_preferences.acceptance === "accepted" &&
    c.credential_preferences.is_public &&
    recipient?.is_public,
  );
}
export function credentialEvidenceUrl(
  c: Credential,
  shared: boolean,
  canViewPrivate: boolean,
) {
  if (!canViewPrivate && !(shared && c.credential_preferences.share_evidence))
    return null;
  return safeCredentialWebsite(c.credential_evidence?.evidence_url);
}
export function safeCredentialWebsite(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return /^(https?:)$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function credentialDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}
export const acceptanceLabels = {
  accepted: "Accepted",
  pending: "Awaiting recipient decision",
  declined: "Declined",
};
export const issuerLabels: Record<string, string> = {
  authorized: "Approved on ProofPak",
  pending: "Awaiting ProofPak approval",
  suspended: "Suspended on ProofPak",
};
export function integrityLabel(state: ProofState, hasProof: boolean) {
  return {
    verified: "Onchain verified",
    pending: hasProof ? "Awaiting finalization" : "Not recorded",
    failed: "Transaction failed",
    mismatch: "Data does not match",
    unavailable: "Check unavailable",
    missing: "Record could not be verified",
  }[state];
}
export const integrityDescriptions: Record<ProofState, string> = {
  verified:
    "A finalized Solana devnet transaction matches this credential’s committed data.",
  pending:
    "The blockchain record has not been completed. Do not treat it as verified.",
  failed:
    "The recorded transaction failed. This credential has no verified integrity proof from that transaction.",
  mismatch:
    "The credential or evidence digest does not match the recorded proof. Do not rely on this integrity record.",
  unavailable:
    "The live check could not be completed. Try again later; no verification is being claimed.",
  missing:
    "No matching finalized transaction could be confirmed. The stored signature alone is not verification.",
};
