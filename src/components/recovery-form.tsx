import { Field, SubmitButton } from "./forms";
import Link from "next/link";
import { sendReset, resendConfirmation } from "@/lib/actions";
export function RecoveryForm({
  kind,
  message,
}: {
  kind: "reset" | "confirmation";
  message?: string;
}) {
  return (
    <div className="auth">
      <h1>
        {kind === "reset" ? "Reset your password." : "Confirm your email."}
      </h1>
      <p className="muted">
        Enter the email you used for ProofPak. Open the link in this same
        browser.
      </p>
      {message && (
        <p className="message section-spacer" role="status">
          {message}
        </p>
      )}
      <form
        className="form"
        action={kind === "reset" ? sendReset : resendConfirmation}
      >
        <Field name="email" label="Email address" type="email" required />
        <SubmitButton>
          {kind === "reset" ? "Send reset link" : "Resend confirmation"}
        </SubmitButton>
      </form>
      <Link className="text-link section-spacer" href="/sign-in">
        Back to sign in
      </Link>
    </div>
  );
}
