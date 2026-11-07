import type { CredentialWorkContext } from "./challenge-assessment";
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
// Accept the slug or copied public passport URL, not arbitrary paths.
export const recipientPassportSlug = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .transform((value) => {
    let slug = value;
    if (/^https?:\/\//i.test(value)) {
      try {
        slug = new URL(value).pathname;
      } catch {
        return "";
      }
    }
    const path = /^\/talent\/([^/]+)\/?$/.exec(slug);
    if (path) slug = path[1];
    return slug.toLowerCase();
  })
  .pipe(
    z
      .string()
      .max(120)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Enter a passport slug or public passport URL.",
      ),
  );
export const credentialInput = z
  .object({
    organization_id: z.uuid(),
    recipient_slug: recipientPassportSlug,
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
  trust_level?: string;
  trust_suspended?: boolean;
  trust_review_id?: string | null;
  id: string;
  company_id: string;
  organization_type: string;
  issuer_status: "pending" | "authorized" | "suspended";
  authorization_id: string | null;
  allowed_credential_types?: string[];
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
  credential_issuance_provenance?:
    | {
        authorization_id: string;
        authorized_credential_type: string;
        issued_at: string;
        representative_recorded: boolean;
      }[]
    | {
        authorization_id: string;
        authorized_credential_type: string;
        issued_at: string;
        representative_recorded: boolean;
      }
    | null;
  credential_challenge_context?:
    CredentialWorkContext[] | CredentialWorkContext | null;
  credential_correction_status?: CorrectionStatus | CorrectionStatus[] | null;
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
  "*, organizations(*, companies(name,description,website)), credential_preferences(*), credential_evidence(*), credential_events:public_credential_events(event_type,reason,created_at), credential_proofs(*), credential_issuance_provenance(*), credential_challenge_context(*), credential_correction_status(*)";
export function credentialValidity(
  c: Pick<Credential, "expiry_date" | "credential_events"> & {
    credential_correction_status?: CorrectionStatus | CorrectionStatus[] | null;
    issue_date?: string;
  },
  today = new Date().toISOString().slice(0, 10),
) {
  return c.credential_events.length
    ? "Revoked"
    : correctionStatus(c)?.superseded
      ? "Superseded"
      : c.issue_date && c.issue_date > today
        ? "Not yet valid"
        : c.expiry_date && c.expiry_date < today
          ? "Expired"
          : "Current";
}

export type CorrectionStatus = {
  credential_id: string;
  is_replacement: boolean;
  replaces_id: string | null;
  superseded: boolean;
  pending_replacement_id: string | null;
  replacement_id: string | null;
  incoming_state: string | null;
};
export function correctionStatus(c: {
  credential_correction_status?: CorrectionStatus | CorrectionStatus[] | null;
}) {
  const v = c.credential_correction_status;
  return Array.isArray(v) ? v[0] : v;
}
