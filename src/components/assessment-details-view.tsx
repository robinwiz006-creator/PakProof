import {
  assessmentMethods,
  type AssessmentDetails,
} from "@/lib/assessment-details";
export function AssessmentDetailsView({
  details: d,
}: {
  details: AssessmentDetails;
}) {
  return (
    <dl className="form section-spacer">
      <dt>Skills or competencies assessed</dt>
      <dd>
        <div className="tags">
          {d.competencies.map((s, i) => (
            <span className="tag" key={i}>
              {s}
            </span>
          ))}
        </div>
      </dd>
      <dt>Assessment method</dt>
      <dd>{assessmentMethods[d.method]}</dd>
      <dt>Challenge level at review</dt>
      <dd>
        {d.challenge_level} — {d.level_definition}
        <p className="muted">
          Context for this work, not a platform-wide rating of the person.
        </p>
      </dd>
      <dt>Evaluator’s result summary</dt>
      <dd style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {d.summary}
      </dd>
      <dt>Score</dt>
      <dd>
        {d.score !== null && d.score_max !== null
          ? `${d.score} / ${d.score_max} (reported by evaluator)`
          : "No numeric score recorded."}
      </dd>
      <dt>Evaluating organization</dt>
      <dd>{d.evaluating_organization}</dd>
      <dt>Reviewer accountability</dt>
      <dd>
        {d.reviewer_attributed
          ? "Reviewed by an authorized organization member. The individual reviewer’s identity is recorded privately."
          : "Individual reviewer attribution was not recorded."}
      </dd>
      <dt>Assessment date</dt>
      <dd>
        {d.assessed_on ??
          "Not recorded; the review-recorded date is shown above."}
      </dd>
    </dl>
  );
}
