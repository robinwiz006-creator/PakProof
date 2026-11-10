"use server";
import { randomBytes, createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "./supabase/server";
import { invitationInput } from "./invitations";
export async function prepareInvitation(
  _previous: { message: string; link?: string },
  form: FormData,
): Promise<{ message: string; link?: string }> {
  if (form.get("review_confirmed") !== "yes")
    return { message: "Review the invitation before creating its link." };
  const parsed = invitationInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: parsed.error.issues[0].message };
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { message: "Sign in again before creating an invitation." };
  const v = parsed.data,
    token = randomBytes(32).toString("hex");
  const { error } = await db.rpc("prepare_credential_invitation", {
    p_organization: v.organization_id,
    p_email: v.recipient_email,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
    p_title: v.title,
    p_type: v.credential_type,
    p_description: v.description,
    p_issue_date: v.issue_date,
    p_expiry_date: v.expiry_date || null,
    p_program: v.program_name,
    p_award: v.award,
    p_evidence: v.evidence_url,
  });
  if (error)
    return {
      message:
        "Could not create the invitation. Check category approval, fields and any existing pending invitation, then retry. Daily limit: 50 per organization.",
    };
  revalidatePath("/credential-invitations");
  return {
    message:
      "Invitation created. Email has not been sent. Copy the link and share it privately with the intended recipient. It expires in 14 days.",
    link: `/credential-invitations/${token}`,
  };
}
export async function decideInvitation(form: FormData) {
  const id = z.uuid().safeParse(form.get("invitation_id"));
  const decision = z
    .enum(["accepted", "declined", "cancelled"])
    .safeParse(form.get("decision"));
  if (!id.success || !decision.success)
    redirect("/credential-invitations?message=Invalid%20request");
  const db = await supabase();
  const { error } = await db.rpc("decide_credential_invitation", {
    p_invitation: id.data,
    p_decision: decision.data,
  });
  revalidatePath("/credential-invitations");
  revalidatePath("/my-credentials");
  revalidatePath("/portal/talent");
  redirect(
    `/credential-invitations?message=${encodeURIComponent(error ? "Unable to complete this action. Check the intended verified email, invitation status and current issuer approval." : decision.data === "accepted" ? "Credential accepted privately. Choose publication in My Credentials." : `Invitation ${decision.data}.`)}`,
  );
}
