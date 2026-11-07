"use client";
import { useState } from "react";
import {
  assessmentMethods,
  challengeLevelDefinitions,
} from "@/lib/assessment-details";
export function AssessmentDetailFields() {
  const [enabled, setEnabled] = useState(false);
  return (
    <fieldset className="section-spacer">
      <legend>Assessment explanation (optional)</legend>
      <label>
        <input
          type="checkbox"
          name="assessment_details"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Record what was assessed and how
      </label>
      <p className="muted">
        This summary may appear on a credential only if the recipient shares
        assessment results. Keep private feedback and contact information in the
        separate feedback field.
      </p>
      {enabled && (
        <div className="form">
          <label className="field">
            Skills or competencies assessed
            <input
              name="competencies"
              required
              maxLength={650}
              placeholder="Keyboard accessibility, React"
            />
            <span className="muted">
              Up to eight, separated by commas. Record only what you actually
              evaluated.
            </span>
          </label>
          <label className="field">
            Primary assessment method
            <select
              name="assessment_method"
              aria-label="Primary assessment method"
              required
              defaultValue=""
            >
              <option value="">Choose the method actually used</option>
              {Object.entries(assessmentMethods).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Publication-ready assessment result
            <textarea
              name="assessment_summary"
              required
              minLength={20}
              maxLength={1500}
            />
          </label>
          <label className="field">
            Assessment date (optional)
            <input
              type="date"
              name="assessed_on"
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <div className="grid-2">
            <label className="field">
              Score (optional, whole number)
              <input
                name="assessment_score"
                type="number"
                min={0}
                max={1000}
                step={1}
              />
            </label>
            <label className="field">
              Maximum score (if scored)
              <input
                name="assessment_score_max"
                type="number"
                min={1}
                max={1000}
                step={1}
              />
            </label>
          </div>
          <p className="muted">
            The challenge’s existing level is captured at review, not used to
            rank the person.
          </p>
          <details>
            <summary>Challenge level definitions</summary>
            {Object.entries(challengeLevelDefinitions).map(
              ([level, definition]) => (
                <p key={level}>
                  <strong>{level}: </strong>
                  {definition}
                </p>
              ),
            )}
          </details>
        </div>
      )}
    </fieldset>
  );
}
