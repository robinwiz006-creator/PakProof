import Link from "next/link";
import { signIn } from "@/lib/actions";
import { isConfigured } from "@/lib/supabase/server";
import { Field, SubmitButton } from "@/components/forms";
export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <div className="auth">
      <p className="eyebrow">WELCOME BACK</p>
      <h1>Your next chapter starts here.</h1>
      <p className="muted">Sign in to your ProofPak or SkillBoard account.</p>
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
        <Field label="Email address" name="email" type="email" required />
        <Field label="Password" name="password" type="password" required />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="auth-bottom">
        New here? <Link href="/sign-up">Create an account</Link> ·{" "}
        <Link href="/portal/talent">Explore the portal</Link>
      </p>
    </div>
  );
}
