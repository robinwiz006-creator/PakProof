import { z } from "zod";
import { credentialInput } from "./credentials";
export const invitationInput = z.preprocess(
  (value) =>
    value && typeof value === "object"
      ? { ...value, recipient_slug: "invited" }
      : value,
  credentialInput.safeExtend({
    recipient_email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  }),
);
export type Invitation = {
  id: string;
  organization_id: string;
  recipient_email: string;
  credential_id: string;
  title: string;
  credential_type: string;
  description: string;
  issue_date: string;
  expiry_date: string | null;
  program_name: string;
  award: string;
  evidence_url: string;
  status: string;
  created_at: string;
  expires_at: string;
};
export const invitationColumns =
  "id,organization_id,recipient_email,credential_id,title,credential_type,description,issue_date,expiry_date,program_name,award,evidence_url,status,created_at,expires_at";
export function invitationStatus(
  i: Pick<Invitation, "status" | "expires_at">,
  now = Date.now(),
) {
  return i.status === "pending" && Date.parse(i.expires_at) <= now
    ? "expired"
    : i.status;
}
