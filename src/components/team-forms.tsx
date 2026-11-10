"use client";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  prepareTeamInvitation,
  manageTeamMember,
  decideTeamInvitation,
} from "@/lib/team-actions";
import {
  assignableRoles,
  teamRoleLabels,
  teamRoleDescriptions,
} from "@/lib/team-permissions";
import { InvitationLink } from "./invitation-form";
function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="button" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
export function TeamInviteForm({
  company,
  role,
}: {
  company: string;
  role: string;
}) {
  const [review, setReview] = useState<{ email: string; role: string } | null>(
    null,
  );
  const [state, action] = useActionState(prepareTeamInvitation, {
    message: "",
  });
  return (
    <form className="form" action={action} onChange={() => setReview(null)}>
      <input type="hidden" name="company_id" value={company} />
      <label>
        Email address
        <input name="recipient_email" type="email" required maxLength={254} />
      </label>
      <label>
        Team role
        <select name="proposed_role" required>
          {assignableRoles(role).map((r) => (
            <option key={r} value={r}>
              {teamRoleLabels[r]}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>What each role can do</summary>
        {assignableRoles(role).map((r) => (
          <p key={r}>
            <strong>{teamRoleLabels[r]}: </strong>
            {teamRoleDescriptions[r]}
          </p>
        ))}
        <p>
          Issuer categories still need independent platform approval. Company
          payments remain owner-only. Ownership transfers are not supported.
        </p>
      </details>
      {review ? (
        <div className="notice">
          <input name="review_confirmed" type="hidden" value="yes" />
          <p>
            Invite {review.email} as {teamRoleLabels[review.role]}?
          </p>
          <p>
            The person must sign in with the verified invited email. No email is
            sent automatically.
          </p>
          {!state.link && (
            <SaveButton>Create private invitation link</SaveButton>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="button"
          onClick={(e) => {
            const f = e.currentTarget.form;
            if (f?.reportValidity()) {
              const d = new FormData(f);
              setReview({
                email: String(d.get("recipient_email")),
                role: String(d.get("proposed_role")),
              });
            }
          }}
        >
          Review team invitation
        </button>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {state.link && <InvitationLink path={state.link} />}
    </form>
  );
}
export function TeamMemberForm({
  company,
  member,
  actorRole,
  currentRole,
}: {
  company: string;
  member: string;
  actorRole: string;
  currentRole: string;
}) {
  return (
    <form
      className="form"
      action={manageTeamMember}
      onSubmit={(e) => {
        if (
          !confirm(
            "Change this member’s organization access? This takes effect immediately.",
          )
        )
          e.preventDefault();
      }}
    >
      <input name="company_id" type="hidden" value={company} />
      <input name="member_id" type="hidden" value={member} />
      <label>
        Change access
        <select name="role" defaultValue="" required>
          <option value="">Choose an action</option>
          {assignableRoles(actorRole)
            .filter((r) => r !== currentRole)
            .map((r) => (
              <option key={r} value={r}>
                {teamRoleLabels[r]}
              </option>
            ))}
          <option value="remove">Remove from organization</option>
        </select>
      </label>
      <SaveButton>Confirm access change</SaveButton>
    </form>
  );
}
export function TeamInvitationDecision({
  id,
  cancel = false,
}: {
  id: string;
  cancel?: boolean;
}) {
  return (
    <form
      className="button-row"
      action={decideTeamInvitation}
      onSubmit={(e) => {
        if (
          !confirm(
            cancel
              ? "Cancel this invitation?"
              : "Confirm your team invitation decision?",
          )
        )
          e.preventDefault();
      }}
    >
      <input type="hidden" name="invitation_id" value={id} />
      {cancel ? (
        <button name="decision" value="cancelled" className="button secondary">
          Cancel invitation
        </button>
      ) : (
        <>
          <button name="decision" value="accepted" className="button">
            Accept invitation
          </button>
          <button name="decision" value="declined" className="button secondary">
            Decline invitation
          </button>
        </>
      )}
    </form>
  );
}
