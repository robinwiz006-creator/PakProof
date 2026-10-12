import { redirect } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabase/server";
import { resetPassword } from "@/lib/actions";
import { Field, SubmitButton } from "@/components/forms";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (!isConfigured())
    redirect("/forgot-password?message=Account+recovery+requires+Supabase.");
  const db = await supabase();
  if (!(await db.auth.getUser()).data.user)
    redirect("/forgot-password?message=Open+the+reset+link+from+your+email.");
  const { message } = await searchParams;
  return (
    <div className="auth">
      <h1>Choose a new password.</h1>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      <form className="form" action={resetPassword}>
        <Field
          name="password"
          label="New password"
          type="password"
          required
          minLength={10}
        />
        <Field
          name="confirm_password"
          label="Confirm new password"
          type="password"
          required
          minLength={10}
        />
        <SubmitButton>Update password</SubmitButton>
      </form>
    </div>
  );
}
