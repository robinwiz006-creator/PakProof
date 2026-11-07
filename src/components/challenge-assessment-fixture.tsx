"use client";
import { useState } from "react";
import { RubricEditor, AssessmentFields } from "./challenge-assessment";
import { CredentialWorkContextView } from "./credential-work-context";
export function ChallengeAssessmentFixture() {
  const [share, setShare] = useState(false);
  return (
    <main className="container page narrow">
      <h1>Offline challenge assessment fixture</h1>
      <p>No live work, credential or blockchain record is created.</p>
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
                schema: 1,
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
