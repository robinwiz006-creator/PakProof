export type DashboardRole = "talent" | "company";
export const personalNavigation = [
  ["/portal/talent", "Home"],
  ["/portal/talent/passport", "My Profile"],
  ["/opportunities", "Opportunities"],
  ["/portal/talent/activity", "My Activity"],
  ["/my-credentials", "Credentials"],
] as const;
export const organizationNavigation = [
  ["/portal/company", "Home"],
  ["/organizations", "Organization & credentials"],
  ["/organization-team", "Organization team"],
  ["/portal/company/challenges", "Challenges"],
  ["/paid-projects?view=company", "Paid projects & applications"],
  ["/portal/company/reviews", "Review challenge work"],
] as const;
export const secondaryNavigation = [
  ["/team-invitations", "Team invitations"],
  ["/credential-invitations", "Credential invitations"],
  ["/contact-requests", "Contact requests"],
  ["/wallet", "Wallet"],
  ["/payments", "Payments"],
  ["/portal/talent/settings", "Account Settings"],
] as const;
export function personalSection(path: string) {
  if (path === "/profile-history") return "/portal/talent/passport";
  if (path.startsWith("/credential-invitations")) return "/my-credentials";
  if (/^\/portal\/talent\/(profile|projects|preview)$/.test(path))
    return "/portal/talent/passport";
  if (
    /^\/portal\/talent\/(achievements|submissions)$/.test(path) ||
    path.startsWith("/paid-projects")
  )
    return "/portal/talent/activity";
  if (path.startsWith("/challenges")) return "/opportunities";
  return path;
}
