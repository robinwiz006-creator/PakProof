import type { Credential } from "@/lib/credentials";
import { CredentialRecord } from "./credential-record";
import { SubmitButton } from "./forms";
export function CredentialInboxItem({
  credential: c,
  action,
}: {
  credential: Credential;
  action: (data: FormData) => Promise<void>;
}) {
  return (
    <div id={`credential-${c.id}`} className="credential-inbox-item">
      <CredentialRecord credential={c} />
      <details className="credential-management">
        <summary>Decision & publication settings</summary>
        <form action={action}>
          <input name="credential_id" type="hidden" value={c.id} />
          <div className="field">
            <label htmlFor={`accept-${c.id}`}>Your decision</label>
            <select
              id={`accept-${c.id}`}
              name="acceptance"
              required
              defaultValue={
                c.credential_preferences.acceptance === "pending"
                  ? ""
                  : c.credential_preferences.acceptance
              }
            >
              <option value="">Choose accept or decline</option>
              <option value="declined">Decline / keep off passport</option>
              <option value="accepted">Accept credential</option>
            </select>
          </div>
          <label>
            <input
              type="checkbox"
              name="is_public"
              defaultChecked={c.credential_preferences.is_public}
            />{" "}
            Display on my published passport
          </label>
          <br />
          <label>
            <input
              type="checkbox"
              name="share_evidence"
              defaultChecked={c.credential_preferences.share_evidence}
            />{" "}
            Also publish supporting evidence
          </label>
          <p className="muted">
            A private passport keeps this credential private. Evidence URLs may
            have their own access settings: check those before sharing.
          </p>
          <SubmitButton>Save my decision and visibility</SubmitButton>
        </form>
      </details>
    </div>
  );
}
