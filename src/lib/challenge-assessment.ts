import type { AssessmentDetails } from "./assessment-details";
import { z } from "zod";
export const rubricSchema = z
  .array(
    z.object({
      title: z.string().trim().min(3).max(100),
      description: z.string().trim().min(10).max(1000),
    }),
  )
  .max(6);
export const assessmentOutcomes = [
  "met",
  "needs_improvement",
  "not_assessed",
] as const;
export const workCredentialTypes = [
  "certification",
  "company_achievement",
  "hackathon_participation",
  "hackathon_achievement",
] as const;
export type Criterion = z.infer<typeof rubricSchema>[number];
export type AssessmentManifest = {
  schema: number;
  details?: AssessmentDetails;
  context_salt?: string;
  challenge_id: string;
  challenge_title: string;
  submission_id: string;
  review_id: string;
  organization_id: string;
  recipient_id: string;
  reviewed_at: string;
  rubric_id: string | null;
  criteria: Criterion[];
  outcomes: string[];
  evidence_digest: string;
};
// PostgreSQL jsonb::text canonical object-key order and spacing, used by the
// immutable source manifest. No change to any v1/v2/v3 claim serializer.
export function assessmentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(assessmentJson).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const enc = new TextEncoder();
    const keys = Object.keys(obj).sort((a, b) => {
      const x = enc.encode(a),
        y = enc.encode(b);
      if (x.length !== y.length) return x.length - y.length;
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return 0;
    });
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${assessmentJson(obj[k])}`).join(", ")}}`;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isSafeInteger(value))
  )
    return JSON.stringify(value);
  throw new Error("Unsupported assessment value");
}
export async function assessmentHash(manifest: AssessmentManifest) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(assessmentJson(manifest)),
      ),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}

export type CredentialWorkContext = {
  challenge_id: string;
  challenge_title: string;
  context_digest: string;
  assessment: AssessmentManifest | null;
};
export function workContext(
  value: CredentialWorkContext | CredentialWorkContext[] | null | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export async function assessmentContextMatches(
  program: string,
  context: CredentialWorkContext | undefined | null,
) {
  return (
    !context ||
    (program === `Assessed work · sha256:${context.context_digest}` &&
      (!context.assessment ||
        (await assessmentHash(context.assessment)) === context.context_digest))
  );
}
