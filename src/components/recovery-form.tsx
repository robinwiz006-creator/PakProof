import { authHref, opportunityAuthMessage } from "@/lib/auth-navigation";
import { safeReturnPath } from "@/lib/passport";
import { Field, SubmitButton } from "./forms";
import Link from "next/link";
import { sendReset, resendConfirmation } from "@/lib/actions";
export function RecoveryForm({
  kind,
  message,
  next: requestedNext,
}: {
  kind: "reset" | "confirmation";
  message?: string;
  next?: string;
}) {
  const next = kind === "confirmation" ? safeReturnPath(requestedNext) : null;
  return (
    <div className="auth">
      <h1>
        {kind === "reset" ? "Reset your password." : "Confirm your email."}
      </h1>
      <p className="muted">
        Enter the email you used for ProofPak. Open the link in this same
        browser.
      </p>
      {next && (
        <p className="notice section-spacer">{opportunityAuthMessage(next)}</p>
      )}
      {message && (
        <p className="message section-spacer" role="status">
          {message}
        </p>
      )}
      <form
        className="form"
        action={kind === "reset" ? sendReset : resendConfirmation}
      >
        <input type="hidden" name="next" value={next ?? ""} />
        <Field name="email" label="Email address" type="email" required />
        <SubmitButton>
          {kind === "reset" ? "Send reset link" : "Resend confirmation"}
        </SubmitButton>
      </form>
      <Link
        className="text-link section-spacer"
        href={authHref("/sign-in", next)}
      >
        Back to sign in
      </Link>
    </div>
  );
}
