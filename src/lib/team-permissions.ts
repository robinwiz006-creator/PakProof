export const assignableTeamRoles = [
  "administrator",
  "credential_manager",
  "opportunity_manager",
  "submission_reviewer",
] as const;
export const teamRoleLabels: Record<string, string> = {
  owner: "Owner",
  administrator: "Administrator",
  credential_manager: "Credential manager",
  opportunity_manager: "Opportunity manager",
  submission_reviewer: "Reviewer (submissions only)",
  reviewer: "Legacy member (existing access)",
};
export type TeamCapability =
  | "team"
  | "settings"
  | "credentials"
  | "opportunities"
  | "review"
  | "discovery";
export function teamCan(role: string | undefined, cap: TeamCapability) {
  if (role === "owner") return true;
  if (role === "administrator") return true;
  if (role === "reviewer") return cap !== "team";
  if (role === "credential_manager") return cap === "credentials";
  if (role === "opportunity_manager")
    return ["opportunities", "review", "discovery"].includes(cap);
  return role === "submission_reviewer" && cap === "review";
}
export function assignableRoles(actor: string) {
  return assignableTeamRoles.filter(
    (r) =>
      actor === "owner" || (actor === "administrator" && r !== "administrator"),
  );
}
export const teamRoleDescriptions: Record<string, string> = {
  administrator:
    "Manage ordinary members and authorized workflows; cannot assign administrators/owners or sign company payments.",
  credential_manager:
    "Issue and manage credentials only in approved categories. No opportunity or team administration.",
  opportunity_manager:
    "Manage opportunities, review work and discover candidates. Company payment signing remains owner-only.",
  submission_reviewer:
    "Review organization challenge submissions and assessment evidence. Cannot create opportunities or issue credentials.",
};
export const teamInvitationColumns =
  "id,company_id,recipient_email,proposed_role,status,created_at,expires_at,responded_at";
export function teamInviteStatus(i: { status: string; expires_at: string }) {
  return i.status === "pending" && Date.parse(i.expires_at) <= Date.now()
    ? "expired"
    : i.status;
}
