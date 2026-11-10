"use client";
import { useFormStatus } from "react-dom";
import { useActionState, useState } from "react";
import { prepareInvitation, decideInvitation } from "@/lib/invitation-actions";
import { credentialTypeLabels } from "@/lib/issuer-permissions";
export function InvitationForm({
  organizations,
}: {
  organizations: { id: string; name: string; types: string[] }[];
}) {
  const [org, setOrg] = useState(organizations[0]?.id ?? "");
  const [review, setReview] = useState(false);
  const [state, action, pending] = useActionState(prepareInvitation, {
    message: "",
  });
  return (
    <form action={action} className="form" onChange={() => setReview(false)}>
      <label>
        Issuing organization
        <select
          name="organization_id"
          value={org}
          onChange={(e) => setOrg(e.target.value)}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Approved category
        <select name="credential_type">
          {organizations
            .find((o) => o.id === org)
            ?.types.map((t) => (
              <option key={t} value={t}>
                {credentialTypeLabels[t as keyof typeof credentialTypeLabels] ??
                  t}
              </option>
            ))}
        </select>
      </label>
      <label>
        Recipient email
        <input type="email" name="recipient_email" required maxLength={254} />
      </label>
      <label>
        Credential title
        <input name="title" required minLength={3} maxLength={160} />
      </label>
      <label>
        Description
        <textarea name="description" required minLength={20} maxLength={4000} />
      </label>
      <label>
        Issue date
        <input type="date" name="issue_date" required />
      </label>
      <label>
        Expiry date (optional)
        <input type="date" name="expiry_date" />
      </label>
      <label>
        Program (optional)
        <input name="program_name" maxLength={200} />
      </label>
      <label>
        Award (optional)
        <input name="award" maxLength={200} />
      </label>
      <label>
        Evidence URL (optional; shared privately with recipient)
        <input type="url" name="evidence_url" />
      </label>
      <p className="muted">
        The recipient must sign in with this verified email and accept. Nothing
        is published automatically. No wallet is needed.
      </p>
      {!review ? (
        <button
          type="button"
          className="button"
          onClick={(e) => {
            if (e.currentTarget.form?.reportValidity()) setReview(true);
          }}
        >
          Review invitation
        </button>
      ) : (
        <div className="notice">
          <input type="hidden" name="review_confirmed" value="yes" />
          <p>
            Review the details above before creating this 14-day invitation. You
            will share its link yourself; no email is sent.
          </p>
          <button className="button" disabled={pending || Boolean(state.link)}>
            {pending ? "Creating…" : "Create invitation link"}
          </button>
        </div>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {state.link && <InvitationLink path={state.link} />}
    </form>
  );
}
export function InvitationLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <p className="muted">
        Share only with the intended recipient. The link is shown once; cancel
        and create a new invitation if lost.
      </p>
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(path, window.location.origin).href,
            );
            setCopied(true);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? "Link copied" : "Copy private invitation link"}
      </button>
      {failed && (
        <p role="status">
          Copy from this link: <a href={path}>Open private invitation</a>
        </p>
      )}
    </div>
  );
}
function DecisionButton({
  decision,
  children,
}: {
  decision: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={decision === "accepted" ? "button" : "button secondary"}
      name="decision"
      value={decision}
      disabled={pending}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
export function InvitationDecision({
  id,
  cancel = false,
}: {
  id: string;
  cancel?: boolean;
}) {
  return (
    <form
      action={decideInvitation}
      className="button-row"
      onSubmit={(e) => {
        if (
          !confirm(
            cancel
              ? "Cancel this invitation?"
              : "Confirm your credential decision?",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="invitation_id" value={id} />
      {cancel ? (
        <DecisionButton decision="cancelled">Cancel invitation</DecisionButton>
      ) : (
        <>
          <DecisionButton decision="accepted">Accept Credential</DecisionButton>
          <DecisionButton decision="declined">
            Decline Credential
          </DecisionButton>
        </>
      )}
    </form>
  );
}
