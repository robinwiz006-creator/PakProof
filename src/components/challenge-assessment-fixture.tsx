"use client";
import { AssessmentDetailFields } from "./assessment-detail-fields";
import {
  assessmentDetailsFromForm,
  challengeLevelDefinitions,
} from "@/lib/assessment-details";
import { useState } from "react";
import { RubricEditor, AssessmentFields } from "./challenge-assessment";
import { CredentialWorkContextView } from "./credential-work-context";
export function ChallengeAssessmentFixture() {
  const [share, setShare] = useState(false);
  const [detailed, setDetailed] = useState(false);
  const [saved, setSaved] = useState("");
  return (
    <main className="container page narrow">
      <h1>Offline challenge assessment fixture</h1>
      <p>No live work, credential or blockchain record is created.</p>
      <form
        action={async (form) => {
          try {
            const d = assessmentDetailsFromForm(form);
            setSaved(
              d
                ? `Offline metadata: ${d.method} · ${d.score ?? "no score"}`
                : "No assessment explanation recorded.",
            );
          } catch {
            setSaved("Check assessment fields. No metadata saved.");
          }
        }}
      >
        <AssessmentDetailFields />
        <button className="button">Capture assessment fields</button>
      </form>
      {saved && <p role="status">{saved}</p>}
      <label>
        <input
          type="checkbox"
          checked={detailed}
          onChange={(e) => setDetailed(e.target.checked)}
        />{" "}
        Use illustrative detailed assessment
      </label>
      <RubricEditor />
      <AssessmentFields
        criteria={[
          {
            title: "Keyboard accessibility",
            description: "All controls support keyboard navigation.",
          },
        ]}
        rubricId="fixture"
      />
      <label>
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
        />
        Share illustrative assessment results
      </label>
      <CredentialWorkContextView
        context={{
          challenge_id: "fixture",
          challenge_title: "Illustrative accessible interface",
          context_digest: "a".repeat(64),
          assessment: share
            ? {
                schema: detailed ? 2 : 1,
                ...(detailed
                  ? {
                      details: {
                        competencies: ["Keyboard accessibility", "React"],
                        method: "code_review" as const,
                        summary:
                          "Implemented keyboard navigation and explained accessible controls.",
                        score: 4,
                        score_max: 5,
                        assessed_on: "2026-11-05",
                        challenge_level: "Beginner",
                        level_definition: challengeLevelDefinitions.Beginner,
                        evaluating_organization:
                          "Illustrative assessment organization",
                        reviewer_attributed: true,
                      },
                    }
                  : {}),
                challenge_id: "fixture",
                challenge_title: "Illustrative accessible interface",
                submission_id: "fixture",
                review_id: "fixture",
                organization_id: "fixture",
                recipient_id: "fixture",
                reviewed_at: "2026-11-05",
                rubric_id: "fixture",
                criteria: [
                  {
                    title: "Keyboard accessibility",
                    description: "All controls support keyboard navigation.",
                  },
                ],
                outcomes: ["met"],
                evidence_digest: "a".repeat(64),
              }
            : null,
        }}
      />
    </main>
  );
}
