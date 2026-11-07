import {
  organizationTrust,
  type TrustOrganization,
  type VerificationRequest,
  type VerificationOutcome,
} from "@/lib/organization-trust";
import {
  submitOrganizationVerification,
  reviewOrganizationVerification,
} from "@/lib/organization-trust-actions";
import { Field, SubmitButton } from "./forms";
import { ConfirmForm } from "./confirm-form";
export function OrganizationTrust({
  organization,
}: {
  organization?: TrustOrganization | null;
}) {
  const s = organizationTrust(organization);
  return (
    <div className="section-spacer">
      <p className="eyebrow">Current institutional verification</p>
      <span className="tag">{s.label}</span>
      {organization?.trust_suspended && (
        <span className="tag">Verification suspended</span>
      )}
      <p className="muted">
        {s.detail} Credential-category permission is separate. This does not
        guarantee every credential or assessment, legal accreditation, or the
        truth of a skill claim.
      </p>
    </div>
  );
}
export function VerificationRequestForm({
  id,
  action = submitOrganizationVerification,
}: {
  id: string;
  action?: (form: FormData) => Promise<void>;
}) {
  return (
    <details className="panel section-spacer">
      <summary>Request organization verification</summary>
      <p>
        Provide institutional information and evidence of your authority to
        represent this organization. Assessment partner review also needs
        assessment standards and evidence.
      </p>
      <p className="notice">
        Private to your organization members and ProofPak administrators. Do not
        submit identity documents, student records, passwords or sensitive
        personal data. Use institutional evidence links. No uploads are
        collected.
      </p>
      <form action={action} className="form">
        <input type="hidden" name="organization_id" value={id} />
        <Field
          name="identity_statement"
          label="Institutional identity and representative authority"
          type="textarea"
          minLength={20}
          maxLength={2000}
          required
        />
        <Field
          name="representative_role"
          label="Your role in the organization"
          minLength={3}
          maxLength={200}
          required
        />
        <Field
          name="identity_evidence_url"
          label="Institutional evidence URL (HTTPS)"
          type="url"
          maxLength={2048}
          required
        />
        <Field
          name="assessment_statement"
          label="Assessment standards (optional)"
          type="textarea"
          maxLength={2000}
        />
        <Field
          name="assessment_evidence_url"
          label="Assessment evidence URL (optional, HTTPS)"
          type="url"
          maxLength={2048}
        />
        <SubmitButton>Submit for independent review</SubmitButton>
      </form>
    </details>
  );
}
export function VerificationRequestHistory({
  requests,
  outcomes,
}: {
  requests: VerificationRequest[];
  outcomes: VerificationOutcome[];
}) {
  return (
    <div className="section-spacer">
      {requests.map((r) => {
        const result = outcomes.find((o) => o.verification_request_id === r.id);
        return (
          <details className="panel section-spacer" key={r.id}>
            <summary>
              Verification request · {r.created_at.slice(0, 10)} ·{" "}
              {result?.trust_decision ?? "Awaiting review"}
            </summary>
            <p>{r.identity_statement}</p>
            <p className="muted">
              Representative role: {r.representative_role}
            </p>
            <a
              className="text-link"
              href={r.identity_evidence_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Institutional evidence ↗
            </a>
            {r.assessment_statement && <p>{r.assessment_statement}</p>}
            {r.assessment_evidence_url && (
              <p>
                <a
                  className="text-link"
                  href={r.assessment_evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Assessment evidence ↗
                </a>
              </p>
            )}
            {result && (
              <p>
                Decision {result.created_at.slice(0, 10)} · Resulting level:{" "}
                {
                  organizationTrust({
                    trust_level: result.resulting_trust_level,
                  }).label
                }
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}
export function OrganizationTrustReviewForm({
  id,
  requestId,
  expectedReview,
  action = reviewOrganizationVerification,
}: {
  id: string;
  requestId: string | null;
  expectedReview: string | null;
  action?: (form: FormData) => Promise<void>;
}) {
  return (
    <ConfirmForm
      action={action}
      title="Confirm institutional trust decision"
      message="This changes institutional trust only. Credential-category permissions and historical credentials remain unchanged. Do not approve without checking evidence and representative authority."
      label="Record trust decision"
    >
      <input type="hidden" name="organization_id" value={id} />
      <input type="hidden" name="request_id" value={requestId ?? ""} />
      <input
        type="hidden"
        name="expected_review"
        value={expectedReview ?? ""}
      />
      <label className="field">
        Institutional trust decision
        <select
          name="decision"
          aria-label="Institutional trust decision"
          required
          defaultValue=""
        >
          <option value="">Choose a decision</option>
          <option value="approve">Approve current request</option>
          <option value="reject">Reject current request</option>
          <option value="suspend">Suspend institutional verification</option>
          <option value="downgrade">Downgrade current trust level</option>
        </select>
      </label>
      <label className="field">
        Target trust level
        <select
          name="level"
          aria-label="Target trust level"
          required
          defaultValue=""
        >
          <option value="">Choose a level</option>
          <option value="self_registered">Self-registered</option>
          <option value="verified_organization">Verified Organization</option>
          <option value="trusted_assessment_partner">
            Trusted Assessment Partner
          </option>
        </select>
      </label>
      <p className="muted">
        Rejection preserves the current trust level. Suspension removes current
        verification. Downgrade must lower it. To stop credential issuance,
        separately suspend category authorization.
      </p>
      <label>
        <input type="checkbox" name="identity_checked" /> I checked current
        institutional identity and representative authority.
      </label>
      <label>
        <input type="checkbox" name="assessment_checked" /> I separately checked
        assessment standards and supporting evidence.
      </label>
      <Field
        name="reason"
        label="Private administrator decision reason"
        type="textarea"
        required
        minLength={20}
        maxLength={2000}
      />
      <SubmitButton>Review and confirm trust decision</SubmitButton>
    </ConfirmForm>
  );
}
