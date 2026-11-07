"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { credentialWorkspace } from "./credential-data";
import { messageLink } from "./navigation-message";
import {
  organizationVerificationInput,
  trustLevels,
} from "./organization-trust";
function finish(
  path: string,
  error: { code?: string; message: string } | null,
  message: string,
): never {
  if (error)
    redirect(
      messageLink(
        path,
        error.code === "P0001"
          ? error.message
          : "Could not save. Check the form and your permissions.",
      ),
    );
  revalidatePath("/organizations");
  revalidatePath("/issuer-admin", "layout");
  revalidatePath("/credentials", "layout");
  revalidatePath("/talent", "layout");
  redirect(messageLink(path, message));
}
export async function submitOrganizationVerification(form: FormData) {
  const path = "/organizations";
  const v = organizationVerificationInput.safeParse(Object.fromEntries(form));
  if (!v.success) redirect(messageLink(path, v.error.issues[0].message));
  const { db } = await credentialWorkspace();
  const p = v.data;
  const { error } = await db.rpc("submit_organization_verification", {
    p_organization: p.organization_id,
    p_identity: p.identity_statement,
    p_role: p.representative_role,
    p_identity_url: p.identity_evidence_url,
    p_assessment: p.assessment_statement,
    p_assessment_url: p.assessment_evidence_url,
  });
  finish(
    path,
    error,
    "Verification information submitted privately. No trust level or credential permissions were granted.",
  );
}
export async function reviewOrganizationVerification(form: FormData) {
  const parsed = z
    .object({
      organization_id: z.uuid(),
      request_id: z.union([z.uuid(), z.literal("")]),
      expected_review: z.union([z.uuid(), z.literal("")]),
      decision: z.enum(["approve", "reject", "suspend", "downgrade"]),
      level: z.enum(trustLevels),
      reason: z.string().trim().min(20).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirect(messageLink("/issuer-admin", parsed.error.issues[0].message));
  const p = parsed.data;
  const { db } = await credentialWorkspace();
  const { error } = await db.rpc("review_organization_verification", {
    p_organization: p.organization_id,
    p_request: ["approve", "reject"].includes(p.decision)
      ? p.request_id || null
      : null,
    p_expected_review: p.expected_review || null,
    p_decision: p.decision,
    p_level: p.level,
    p_reason: p.reason,
    p_identity_checked: form.get("identity_checked") === "on",
    p_assessment_checked: form.get("assessment_checked") === "on",
  });
  finish(
    `/issuer-admin/${p.organization_id}`,
    error,
    "Institutional trust decision recorded. Credential-category permissions were not changed.",
  );
}
