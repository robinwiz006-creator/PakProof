export type ProofState =
  "pending" | "mismatch" | "failed" | "unavailable" | "verified" | "missing";
export function verificationState(input: {
  stored: boolean;
  hashMatches: boolean;
  checked?: { valid: boolean; status?: string };
  networkError?: boolean;
}): ProofState {
  if (!input.stored) return "pending";
  if (!input.hashMatches) return "mismatch";
  if (input.networkError) return "unavailable";
  if (input.checked?.status === "failed") return "failed";
  if (input.checked?.valid && input.checked.status === "finalized")
    return "verified";
  if (input.checked?.status === "pending") return "pending";
  return "missing";
}
export const verificationLabels: Record<ProofState, string> = {
  pending: "Onchain proof pending",
  mismatch: "Record hash mismatch",
  failed: "Transaction failed",
  unavailable: "Network verification unavailable",
  verified: "Onchain verified",
  missing: "Onchain record could not be verified",
};
