"use client";
import { useState } from "react";
import { type Criterion, assessmentOutcomes } from "@/lib/challenge-assessment";
export function RubricEditor({ initial = [] }: { initial?: Criterion[] }) {
  const [criteria, setCriteria] = useState(initial);
  return (
    <fieldset className="section-spacer">
      <legend>Assessment criteria (optional)</legend>
      <p className="muted">
        Add up to six things you will evaluate. An approval requires every
        defined criterion to be met.
      </p>
      <input type="hidden" name="criteria" value={JSON.stringify(criteria)} />
      {criteria.map((c, i) => (
        <div className="panel section-spacer" key={i}>
          <label className="field">
            Criterion {i + 1} title
            <input
              required
              minLength={3}
              maxLength={100}
              value={c.title}
              onChange={(e) =>
                setCriteria(
                  criteria.map((r, n) =>
                    n === i ? { ...r, title: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <label className="field">
            What will you evaluate?
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={c.description}
              onChange={(e) =>
                setCriteria(
                  criteria.map((r, n) =>
                    n === i ? { ...r, description: e.target.value } : r,
                  ),
                )
              }
            />
          </label>
          <button
            className="text-link"
            type="button"
            onClick={() => setCriteria(criteria.filter((_, n) => n !== i))}
          >
            Remove criterion {i + 1}
          </button>
        </div>
      ))}
      {criteria.length < 6 && (
        <button
          type="button"
          className="button secondary section-spacer"
          onClick={() =>
            setCriteria([...criteria, { title: "", description: "" }])
          }
        >
          Add criterion
        </button>
      )}
    </fieldset>
  );
}
export function AssessmentFields({
  criteria,
  rubricId,
}: {
  criteria: Criterion[];
  rubricId?: string;
}) {
  return (
    <fieldset>
      <legend>Assessment outcomes</legend>
      <input type="hidden" name="rubric_id" value={rubricId ?? ""} />
      {!criteria.length ? (
        <p className="muted">
          No structured criteria. Your written review is retained; no rubric
          result will be invented.
        </p>
      ) : (
        criteria.map((c, i) => (
          <label key={i} className="field">
            {c.title}
            <span className="muted">{c.description}</span>
            <select name="outcomes" required defaultValue="">
              <option value="">Choose outcome</option>
              {assessmentOutcomes.map((o) => (
                <option value={o} key={o}>
                  {o === "met"
                    ? "Meets criterion"
                    : o === "needs_improvement"
                      ? "Needs improvement"
                      : "Not assessed"}
                </option>
              ))}
            </select>
          </label>
        ))
      )}
    </fieldset>
  );
}
