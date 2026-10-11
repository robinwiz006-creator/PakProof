import Link from "next/link";
import { signUp } from "@/lib/actions";
import { isConfigured } from "@/lib/supabase/server";
import { Field, SubmitButton } from "@/components/forms";
export default async function SignUp({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; role?: string }>;
}) {
  const { message, role } = await searchParams;
  return (
    <div className="auth">
      <p className="eyebrow">START WITH WHAT YOU CAN DO</p>
      <h1>Create your account.</h1>
      <p className="muted">
        Build your passport or discover talent through SkillBoard.
      </p>
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
      <form className="form" action={signUp}>
        <label className="field">
          I’m here to
          <select
            name="role"
            defaultValue={role === "company" ? "company" : "talent"}
          >
            <option value="talent">Build my skill passport</option>
            <option value="company">Find talent with SkillBoard</option>
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
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </div>
  );
}
