import { z } from "zod";
import {
  authHref,
  confirmationCallbackUrl,
  signedInDestination,
  type AuthUser,
} from "./auth-navigation";
import { messageLink } from "./navigation-message";

// The same orchestration is used by real actions and isolated service-mock tests.
// No fixture accounts, session bypass, or alternate authentication mode exists here.
type AuthResult = {
  data: { user?: AuthUser | null; session?: unknown };
  error: unknown;
};
type Configuration = { configured: boolean };
const confirmed = (r: AuthResult) => !r.error && r.data.user && r.data.session;

export async function passwordSignIn(
  form: FormData,
  deps: Configuration & {
    signIn: (values: {
      email: string;
      password: string;
    }) => Promise<AuthResult>;
  },
) {
  const path = authHref("/sign-in", form.get("next"));
  if (!deps.configured)
    return messageLink(path, "Connect Supabase before signing in.");
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return messageLink(path, parsed.error.issues[0].message);
  try {
    const result = await deps.signIn(parsed.data);
    if (confirmed(result))
      return signedInDestination(result.data.user!, form.get("next"));
  } catch {
    /* Keep credentials and provider internals out of user-facing errors. */
  }
  return messageLink(
    path,
    "Sign in failed. Check your email and password, and confirm your email if required.",
  );
}

export async function passwordSignUp(
  form: FormData,
  deps: Configuration & {
    siteUrl: string;
    profileReady: () => Promise<boolean>;
    signUp: (values: {
      email: string;
      password: string;
      options: {
        data: { full_name: string; preferred_role: string };
        emailRedirectTo: string;
      };
    }) => Promise<AuthResult>;
  },
) {
  const next = form.get("next");
  const path = authHref("/sign-up", next, form.get("role"));
  if (!deps.configured)
    return messageLink(path, "Connect Supabase before creating an account.");
  const parsed = z
    .object({
      email: z.string().email(),
      password: z.string().min(10),
      full_name: z.string().trim().min(2).max(100),
      role: z.enum(["talent", "company"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return messageLink(path, parsed.error.issues[0].message);
  try {
    if (!(await deps.profileReady()))
      return messageLink(
        path,
        "Account setup is not ready yet. Please contact the platform administrator.",
      );
    const v = parsed.data;
    const result = await deps.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { full_name: v.full_name, preferred_role: v.role },
        emailRedirectTo: confirmationCallbackUrl(deps.siteUrl, next),
      },
    });
    if (result.error)
      return messageLink(
        path,
        "Account could not be created. Check your email, password, and authentication settings.",
      );
    if (confirmed(result)) return signedInDestination(result.data.user!, next);
    return messageLink(
      authHref("/sign-in", next),
      "Check your email to confirm your account, then sign in.",
    );
  } catch {
    return messageLink(
      path,
      "Account could not be created right now. Please try again.",
    );
  }
}

export async function resendSignupConfirmation(
  form: FormData,
  deps: Configuration & {
    siteUrl: string;
    resend: (values: {
      type: "signup";
      email: string;
      options: { emailRedirectTo: string };
    }) => Promise<{ error: unknown }>;
  },
) {
  const path = authHref("/resend-confirmation", form.get("next"));
  if (!deps.configured)
    return messageLink(path, "Email confirmation requires Supabase.");
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return messageLink(path, email.error.issues[0].message);
  try {
    const result = await deps.resend({
      type: "signup",
      email: email.data,
      options: {
        emailRedirectTo: confirmationCallbackUrl(
          deps.siteUrl,
          form.get("next"),
        ),
      },
    });
    if (!result.error)
      return messageLink(
        path,
        "If confirmation is needed, a new link will be sent. Check your inbox and spam folder.",
      );
  } catch {
    /* Same privacy-preserving failure for provider/network errors. */
  }
  return messageLink(
    path,
    "Could not send a confirmation email right now. Wait and try again.",
  );
}

export async function emailConfirmationDestination(
  params: URLSearchParams,
  deps: Configuration & {
    exchange: (code: string) => Promise<AuthResult>;
  },
) {
  const next = params.get("next");
  const code = params.get("code");
  if (code && deps.configured) {
    try {
      const result = await deps.exchange(code);
      if (confirmed(result)) {
        // Password recovery always wins over an opportunity return target.
        return params.get("purpose") === "recovery"
          ? "/reset-password"
          : signedInDestination(result.data.user!, next);
      }
    } catch {
      /* Expired/used codes and transport errors keep a safe retry path. */
    }
  }
  return messageLink(
    authHref("/sign-in", next),
    "Email confirmation failed. Use Resend confirmation or request a new password reset link.",
  );
}
