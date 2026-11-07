import { z } from "zod";
export const trustLevels = [
  "self_registered",
  "verified_organization",
  "trusted_assessment_partner",
] as const;
export type TrustOrganization = {
  trust_level?: string;
  trust_suspended?: boolean;
  trust_review_id?: string | null;
};
export function organizationTrust(o?: TrustOrganization | null) {
  if (o?.trust_suspended)
    return {
      label: "Self-registered",
      detail:
        "Institutional verification is suspended. No current identity or assessment trust is claimed.",
    };
  if (o?.trust_level === "trusted_assessment_partner")
    return {
      label: "Trusted Assessment Partner",
      detail:
        "Institutional identity and assessment standards reviewed by ProofPak administrators.",
    };
  if (o?.trust_level === "verified_organization")
    return {
      label: "Verified Organization",
      detail:
        "Institutional identity reviewed by ProofPak administrators. Assessment standards are not reviewed by this level.",
    };
  return {
    label: "Self-registered",
    detail:
      "Organization account exists; institutional identity has not been independently verified through this process.",
  };
}
const evidenceUrl = z
  .url()
  .max(2048)
  .refine(
    (v) => new URL(v).protocol === "https:",
    "Use an HTTPS evidence URL.",
  );
export const organizationVerificationInput = z.object({
  organization_id: z.uuid(),
  identity_statement: z.string().trim().min(20).max(2000),
  representative_role: z.string().trim().min(3).max(200),
  identity_evidence_url: evidenceUrl,
  assessment_statement: z.string().trim().max(2000),
  assessment_evidence_url: z.union([z.literal(""), evidenceUrl]),
});
export type VerificationRequest = {
  id: string;
  organization_id: string;
  identity_statement: string;
  representative_role: string;
  identity_evidence_url: string;
  assessment_statement: string;
  assessment_evidence_url: string;
  created_at: string;
};
export type VerificationOutcome = {
  verification_request_id: string | null;
  trust_decision: string;
  resulting_trust_level: string;
  created_at: string;
};
