import Link from "next/link";
import { signIn } from "@/lib/actions";
import {
  authHref,
  opportunityAuthMessage,
  signedInDestination,
} from "@/lib/auth-navigation";
import { safeReturnPath } from "@/lib/passport";
import { redirect } from "next/navigation";
import { currentUser, isConfigured } from "@/lib/supabase/server";
import { Field, SubmitButton } from "@/components/forms";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next: requestedNext } = await searchParams;
  const next = safeReturnPath(requestedNext);
  const user = isConfigured() ? await currentUser() : null;
  if (user) redirect(signedInDestination(user, next));
  const contextMessage = opportunityAuthMessage(next);
  return (
    <div className="auth">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Your next chapter starts here.</h1>
      <p className="muted">Sign in to your ProofPak account.</p>
      {contextMessage && (
        <p className="notice section-spacer">{contextMessage}</p>
      )}
      {!isConfigured() && (
        <div className="notice section-spacer">
          Accounts are not connected yet. Supabase configuration is required.
          You can explore the labeled demo without an account.
        </div>
      )}
      {message && (
        <p className="message section-spacer" role="status">
          {message}
        </p>
      )}
      <form className="form" action={signIn}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email address" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="auth-bottom">
        New here?{" "}
        <Link href={authHref("/sign-up", next)}>Create an account</Link> ·{" "}
        <Link href="/forgot-password">Forgot password?</Link> ·{" "}
        <Link href={authHref("/resend-confirmation", next)}>
          Resend confirmation
        </Link>
      </p>
    </div>
  );
}
