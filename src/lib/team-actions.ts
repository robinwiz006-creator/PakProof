"use server";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { credentialWorkspace } from "./credential-data";
import { assignableTeamRoles } from "./team-permissions";
export async function prepareTeamInvitation(
  _previous: { message: string; link?: string },
  form: FormData,
): Promise<{ message: string; link?: string }> {
  const v = z
    .object({
      company_id: z.uuid(),
      recipient_email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
      proposed_role: z.enum(assignableTeamRoles),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { message: v.error.issues[0].message };
  if (form.get("review_confirmed") !== "yes")
    return { message: "Review the invitation before creating its link." };
  const { db } = await credentialWorkspace();
  const token = randomBytes(32).toString("hex");
  const { error } = await db.rpc("prepare_team_invitation", {
    p_company: v.data.company_id,
    p_email: v.data.recipient_email,
    p_role: v.data.proposed_role,
    p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error)
    return {
      message:
        "Could not create the invitation. Check your role, any pending invitation and the daily limit, then retry.",
    };
  revalidatePath("/organization-team");
  return {
    message:
      "Invitation created for seven days. No email was sent. Share this private link with the intended person.",
    link: `/team-invitations/${token}`,
  };
}
export async function decideTeamInvitation(form: FormData) {
  const v = z
    .object({
      invitation_id: z.uuid(),
      decision: z.enum(["accepted", "declined", "cancelled"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) redirect("/team-invitations?message=Invalid%20request");
  const { db } = await credentialWorkspace();
  const { data, error } = await db.rpc("decide_team_invitation", {
    p_invitation: v.data.invitation_id,
    p_decision: v.data.decision,
  });
  revalidatePath("/organization-team");
  revalidatePath("/team-invitations");
  revalidatePath("/portal");
  const path =
    v.data.decision === "cancelled"
      ? "/organization-team"
      : "/team-invitations";
  redirect(
    `${path}?${data ? `company=${encodeURIComponent(data)}&` : ""}message=${encodeURIComponent(error ? "Action unavailable. Check the intended verified email, expiry, current permissions and invitation status." : `Invitation ${v.data.decision}. Your Passport privacy was not changed.`)}`,
  );
}
export async function manageTeamMember(form: FormData) {
  const v = z
    .object({
      company_id: z.uuid(),
      member_id: z.uuid(),
      role: z.enum([...assignableTeamRoles, "remove"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) redirect("/organization-team?message=Invalid%20request");
  const { db } = await credentialWorkspace();
  const { error } = await db.rpc("manage_team_member", {
    p_company: v.data.company_id,
    p_member: v.data.member_id,
    p_role: v.data.role,
  });
  revalidatePath("/organization-team");
  revalidatePath("/portal");
  revalidatePath("/organizations");
  redirect(
    `/organization-team?company=${v.data.company_id}&message=${encodeURIComponent(error ? "Access was not changed. Check management permissions and owner safeguards." : "Team access updated. Changes take effect immediately.")}`,
  );
}
