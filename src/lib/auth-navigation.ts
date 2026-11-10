import { safeReturnPath } from "./passport";

export type AuthUser = { user_metadata?: { preferred_role?: unknown } };
export type AuthPage = "/sign-in" | "/sign-up" | "/resend-confirmation";

/** Only an explicitly allowed internal destination travels through authentication. */
export function authHref(page: AuthPage, value: unknown, role?: unknown) {
  const next = safeReturnPath(value);
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (page === "/sign-up" && role === "company") params.set("role", "company");
  return page + (params.size ? `?${params}` : "");
}

export function signedInDestination(user: AuthUser, value: unknown) {
  return (
    safeReturnPath(value) ??
    `/portal/${user.user_metadata?.preferred_role === "company" ? "company" : "talent"}`
  );
}

export function opportunityAuthMessage(value: unknown) {
  const next = safeReturnPath(value);
  return next?.startsWith("/team-invitations")
    ? "Sign in with the invited verified email to review your team role."
    : next === "/profile-history"
      ? "Sign in to manage your education and work experience."
      : next?.startsWith("/credential-invitations")
        ? "Sign in with the invited email to review your credential privately."
        : next
          ? `Continue to your selected ${next.startsWith("/challenges/") ? "challenge" : "project"} after signing in. You can review it before taking any action.`
          : null;
}

export function confirmationCallbackUrl(siteUrl: string, value: unknown) {
  const url = new URL("/auth/callback", siteUrl);
  const next = safeReturnPath(value);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

/** Global Auth links retain context only on an opportunity or its Auth handoff pages. */
export function navigationAuthContext(path: string | null, value: unknown) {
  return (
    safeReturnPath(path) ??
    (["/sign-in", "/sign-up", "/resend-confirmation"].includes(path ?? "")
      ? safeReturnPath(value)
      : null)
  );
}
