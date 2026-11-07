import type { CredentialWorkContext } from "@/lib/challenge-assessment";
import { AssessmentDetailsView } from "./assessment-details-view";
export function CredentialWorkContextView({
  context,
}: {
  context: CredentialWorkContext;
}) {
  const a = context.assessment,
    d = a?.details;
  return (
    <section className="panel section-spacer">
      <h2>Work behind this credential</h2>
      <h3>{context.challenge_title}</h3>
      <p className="muted">
        Issued separately after company review. Challenge approval alone is an
        achievement, not a qualification. This is the organization’s assessment;
        ProofPak has not independently rescored the work.
      </p>
      {a ? (
        <>
          <p>Review recorded {a.reviewed_at.slice(0, 10)}</p>
          {d ? (
            <AssessmentDetailsView details={d} />
          ) : (
            <p className="notice">
              Method, competency summary, difficulty and numeric score were not
              recorded with this historical assessment. They have not been
              inferred from the current challenge.
            </p>
          )}
          <h4 className="section-spacer">Recorded assessment criteria</h4>
          {a.criteria.length ? (
            <ul>
              {a.criteria.map((c, i) => (
                <li key={i}>
                  <strong>{c.title}</strong> —{" "}
                  {a.outcomes[i] === "met"
                    ? "Meets criterion"
                    : a.outcomes[i]?.replaceAll("_", " ")}
                  <p className="muted">{c.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No structured rubric was recorded for this review.</p>
          )}
        </>
      ) : (
        <p className="muted">
          Assessment results are private. The recipient can choose to share them
          using the credential’s evidence setting. No method, result or score is
          disclosed here.
        </p>
      )}
      <p className="muted">
        Supporting evidence is shown separately only when permitted. Private
        reviewer feedback and submission contents are never copied into this
        summary.
      </p>
      <details>
        <summary>Assessment integrity reference</summary>
        <p className="hash">{context.context_digest}</p>
        <p className="muted">
          This reference is included in the credential’s committed program
          field. A matching Solana record protects the commitment, not the truth
          of the assessment. Reviewer notes and private submission contents are
          never shown here.
        </p>
        <p className="muted">
          {a
            ? `Assessment snapshot schema ${a.schema}`
            : "Assessment snapshot contents are not public."}
        </p>
      </details>
    </section>
  );
}
