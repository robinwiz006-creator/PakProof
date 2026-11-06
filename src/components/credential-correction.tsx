import Link from "next/link";
import { correctionStatus, type Credential } from "@/lib/credentials";
import { Field, SubmitButton } from "./forms";
import { correctCredential } from "@/lib/credential-actions";
export function CredentialCorrectionNotice({
  credential: c,
}: {
  credential: Credential;
}) {
  const s = correctionStatus(c);
  if (!s) return null;
  return (
    <div className="section-spacer">
      {s.is_replacement && (
        <p className="muted">
          This corrects an earlier credential.{" "}
          {s.replaces_id && (
            <Link className="text-link" href={`/credentials/${s.replaces_id}`}>
              View earlier record ↗
            </Link>
          )}
        </p>
      )}
      {s.incoming_state === "pending" && (
        <p className="notice">
          Review before accepting. Acceptance marks the earlier record
          superseded, even if this correction stays private. Publication and
          evidence sharing are separate choices.
        </p>
      )}
      {s.incoming_state === "declined" && (
        <p className="notice">
          Replacement declined. The earlier record was not superseded. Ask the
          issuer for a new proposal if needed.
        </p>
      )}
      {s.incoming_state === "withdrawn" && (
        <p className="notice">
          This proposal was withdrawn through revocation and cannot be accepted.
        </p>
      )}
      {s.incoming_state === "accepted" &&
        c.credential_preferences.acceptance === "declined" && (
          <p className="notice">
            Acceptance withdrawn. The earlier record remains superseded and is
            not restored automatically.
          </p>
        )}
      {s.superseded && (
        <p className="notice">
          Superseded by an accepted correction. Historical blockchain integrity
          does not make this record current.{" "}
          {s.replacement_id ? (
            <Link
              className="text-link"
              href={`/credentials/${s.replacement_id}`}
            >
              View current replacement ↗
            </Link>
          ) : (
            "The current replacement is not public."
          )}
        </p>
      )}
      {!s.superseded && s.pending_replacement_id && (
        <p className="notice">
          A replacement awaits the recipient’s decision. The earlier record has
          not been superseded.{" "}
          <Link
            className="text-link"
            href={`/credentials/${s.pending_replacement_id}`}
          >
            Review replacement ↗
          </Link>
        </p>
      )}
    </div>
  );
}
export function CredentialCorrectionForm({
  credential: c,
}: {
  credential: Credential;
}) {
  const s = correctionStatus(c),
    linked = Boolean(
      c.credential_challenge_context &&
      (!Array.isArray(c.credential_challenge_context) ||
        c.credential_challenge_context.length),
    );
  if (
    s?.superseded ||
    s?.pending_replacement_id ||
    ["pending", "declined", "withdrawn"].includes(s?.incoming_state ?? "")
  )
    return null;
  return (
    <details className="panel section-spacer">
      <summary>Create a corrected replacement</summary>
      <p className="muted">
        The original stays unchanged. Organization, recipient and category stay
        fixed. Acceptance and publication require a new recipient decision.
      </p>
      <form action={correctCredential} className="form">
        <input name="original_id" type="hidden" value={c.id} />
        <Field
          name="reason"
          label="Private correction reason"
          hint="Only issuer staff and ProofPak administrators can read this audit reason."
          type="textarea"
          minLength={10}
          maxLength={2000}
          required
        />
        <Field
          name="title"
          label="Corrected title"
          value={c.title}
          minLength={3}
          maxLength={160}
          required
        />
        <Field
          name="description"
          label="Corrected description"
          value={c.description.replace(
            /\n\nCorrection reference sha256:[a-f0-9]{64}\.$/,
            "",
          )}
          type="textarea"
          minLength={20}
          maxLength={3850}
          required
        />
        <Field
          name="issue_date"
          label="Issue date"
          type="date"
          value={c.issue_date}
          required
        />
        <Field
          name="expiry_date"
          label="Expiry date (optional)"
          type="date"
          value={c.expiry_date ?? ""}
        />
        <Field
          name="award"
          label="Award or rank (optional)"
          value={c.award}
          maxLength={200}
        />
        {linked ? (
          <>
            <p className="muted">
              Approved challenge, assessment, program and evidence are
              preserved.
            </p>
            <input name="program_name" type="hidden" value={c.program_name} />
            <input
              name="evidence_url"
              type="hidden"
              value={c.credential_evidence?.evidence_url ?? ""}
            />
          </>
        ) : (
          <>
            <Field
              name="program_name"
              label="Program (optional)"
              value={c.program_name}
              maxLength={200}
            />
            <Field
              name="evidence_url"
              label="Evidence URL (optional)"
              value={c.credential_evidence?.evidence_url ?? ""}
            />
          </>
        )}
        <label>
          <input type="checkbox" required /> I reviewed this replacement. No
          consent or blockchain proof is copied.
        </label>
        <SubmitButton>Send correction for recipient review</SubmitButton>
      </form>
    </details>
  );
}
