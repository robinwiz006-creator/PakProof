import Link from "next/link";
import { signUp } from "@/lib/actions";
import {
  authHref,
  opportunityAuthMessage,
  signedInDestination,
} from "@/lib/auth-navigation";
import { safeReturnPath } from "@/lib/passport";
import { redirect } from "next/navigation";
import { currentUser, isConfigured } from "@/lib/supabase/server";
import { Field, SubmitButton } from "@/components/forms";
export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; role?: string; next?: string }>;
}) {
  const { message, role, next: requestedNext } = await searchParams;
  const next = safeReturnPath(requestedNext);
  const user = isConfigured() ? await currentUser() : null;
  if (user) redirect(signedInDestination(user, next));
  const contextMessage = opportunityAuthMessage(next);
  return (
    <div className="auth">
      <p className="eyebrow">START WITH WHAT YOU CAN DO</p>
      <h1>Create your account.</h1>
      <p className="muted">
        Create your Skill Passport in a few short steps. Skills and projects can
        be added later. You do not need a wallet.
      </p>
      {contextMessage && (
        <p className="notice section-spacer">{contextMessage}</p>
      )}
      {!isConfigured() && (
        <div className="notice section-spacer">
          Account creation requires Supabase. Demo browsing is available; it
          does not create or save an account.
        </div>
      )}
      {message && (
        <p className="message section-spacer" role="status">
          {message}
        </p>
      )}
      <p className="muted">
        One account works for your personal profile and organizations. Choose
        where you want to start; you can switch later.
      </p>
      <form className="form" action={signUp}>
        <input type="hidden" name="next" value={next ?? ""} />
        <label className="field">
          I’m here to
          <select
            name="role"
            defaultValue={role === "company" ? "company" : "talent"}
          >
            <option value="talent">Build my skill passport</option>
            <option value="company">Manage an organization</option>
          </select>
        </label>
        <Field
          label="Your full name"
          name="full_name"
          required
          minLength={2}
          maxLength={100}
        />
        <Field label="Email address" name="email" type="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          required
          minLength={10}
          hint="Use at least 10 characters."
        />
        <SubmitButton>Create account</SubmitButton>
      </form>
      <p className="auth-bottom">
        Already have an account?{" "}
        <Link href={authHref("/sign-in", next)}>Sign in</Link>
      </p>
    </div>
  );
}
