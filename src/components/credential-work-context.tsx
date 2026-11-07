import type { CredentialWorkContext } from "@/lib/challenge-assessment";

export function CredentialWorkContextView({
  context,
}: {
  context: CredentialWorkContext;
}) {
  return (
    <section className="panel section-spacer">
      <h2>Work behind this credential</h2>
      <h3>{context.challenge_title}</h3>
      <p className="muted">
        Issued separately after company review. Challenge approval alone is an
        achievement, not a qualification.
      </p>
      {context.assessment ? (
        <>
          <p>Reviewed {context.assessment.reviewed_at.slice(0, 10)}</p>
          {context.assessment.criteria.length ? (
            <ul>
              {context.assessment.criteria.map((c, i) => (
                <li key={i}>
                  <strong>{c.title}</strong> —{" "}
                  {context.assessment!.outcomes[i] === "met"
                    ? "Meets criterion"
                    : context.assessment!.outcomes[i]?.replaceAll("_", " ")}
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
          using the credential’s evidence setting.
        </p>
      )}
      <details>
        <summary>Assessment integrity reference</summary>
        <p className="hash">{context.context_digest}</p>
        <p className="muted">
          This reference is included in the credential’s committed program
          field. A matching Solana record protects the commitment, not the truth
          of the assessment. Reviewer notes and private submission contents are
          never shown here.
        </p>
      </details>
    </section>
  );
}
