import { z } from "zod";
export const organizationTypes = [
  "university",
  "training",
  "community",
  "hackathon",
  "company",
  "other",
] as const;
export const credentialTypes = [
  "degree",
  "course",
  "workshop",
  "bootcamp",
  "hackathon_participation",
  "hackathon_achievement",
  "certification",
  "company_achievement",
] as const;
const url = z.union([
  z.literal(""),
  z
    .url()
    .refine(
      (v) => /^https?:\/\//.test(v),
      "Use an HTTP or HTTPS evidence URL.",
    ),
]);
export const credentialInput = z
  .object({
    organization_id: z.uuid(),
    recipient_slug: z.string().trim().min(1).max(120),
    title: z.string().trim().min(3).max(160),
    credential_type: z.enum(credentialTypes),
    description: z.string().trim().min(20).max(4000),
    issue_date: z.iso.date(),
    expiry_date: z.union([z.literal(""), z.iso.date()]),
    program_name: z.string().trim().max(200),
    award: z.string().trim().max(200),
    evidence_url: url,
  })
  .refine((v) => !v.expiry_date || v.expiry_date >= v.issue_date, {
    message: "Expiry must be on or after the issue date.",
    path: ["expiry_date"],
  });
export type Organization = {
  id: string;
  company_id: string;
  organization_type: string;
  issuer_status: "pending" | "authorized" | "suspended";
  authorization_id: string | null;
  companies: { name: string; description: string; website: string };
};
export type Credential = {
  id: string;
  organization_id: string;
  authorization_id: string;
  recipient_id: string;
  issuer_name: string;
  title: string;
  credential_type: string;
  description: string;
  issue_date: string;
  expiry_date: string | null;
  program_name: string;
  award: string;
  evidence_digest: string;
  created_at: string;
  organizations?: Organization;
  credential_preferences: {
    acceptance: "pending" | "accepted" | "declined";
    is_public: boolean;
    share_evidence: boolean;
  };
  credential_evidence?: { evidence_url: string; digest_salt: string } | null;
  credential_proofs?: {
    signature: string;
    record_hash: string;
    issuer_wallet: string;
    anchored_at: string;
  }[];
  credential_events: {
    event_type: string;
    reason: string;
    created_at: string;
  }[];
};
export const credentialSelect =
  "*, organizations(*, companies(name,description,website)), credential_preferences(*), credential_evidence(*), credential_events(*), credential_proofs(*)";
export function credentialValidity(
  c: Pick<Credential, "expiry_date" | "credential_events"> & {
    issue_date?: string;
  },
  today = new Date().toISOString().slice(0, 10),
) {
  return c.credential_events.length
    ? "Revoked"
    : c.issue_date && c.issue_date > today
      ? "Not yet valid"
      : c.expiry_date && c.expiry_date < today
        ? "Expired"
        : "Current";
}
