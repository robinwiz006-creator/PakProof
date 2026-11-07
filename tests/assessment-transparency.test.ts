import test from "node:test";
import assert from "node:assert/strict";
import {
  assessmentDetailsInput,
  assessmentDetailsFromForm,
  challengeLevelDefinitions,
} from "../src/lib/assessment-details";
import {
  assessmentHash,
  assessmentContextMatches,
  type AssessmentManifest,
} from "../src/lib/challenge-assessment";
const detail = {
  competencies: ["React"],
  method: "code_review",
  summary: "Reviewed source code and the working accessible interface.",
  score: 4,
  score_max: 5,
  assessed_on: "2020-01-01",
};
test("structured assessment validates actual method, competency, date and optional whole-number score", () => {
  assert.ok(assessmentDetailsInput.safeParse(detail).success);
  assert.ok(
    assessmentDetailsInput.safeParse({
      ...detail,
      score: null,
      score_max: null,
      assessed_on: null,
    }).success,
  );
  for (const patch of [
    { competencies: [] },
    { method: "blockchain_verified_skill" },
    { summary: "short" },
    { score: 6 },
    { score: 1.5 },
    { score_max: null },
    { assessed_on: "2999-01-01" },
  ])
    assert.equal(
      assessmentDetailsInput.safeParse({ ...detail, ...patch }).success,
      false,
    );
  assert.match(challengeLevelDefinitions.Beginner, /bounded/);
});
test("unchecked optional review details create no historical or default assessment claims", () => {
  const form = new FormData();
  form.set("assessment_method", "interview");
  assert.equal(assessmentDetailsFromForm(form), null);
  form.set("assessment_details", "on");
  form.set("competencies", "React, Accessibility");
  form.set("assessment_summary", detail.summary);
  form.set("assessment_score", "0");
  form.set("assessment_score_max", "5");
  form.set("assessed_on", "2020-01-01");
  assert.equal(assessmentDetailsFromForm(form)?.score, 0);
});
test("schema-2 context commits all new metadata while schema-1 remains unchanged", async () => {
  const legacy: AssessmentManifest = {
    schema: 1,
    challenge_id: "c",
    challenge_title: "Original reviewed work",
    submission_id: "s",
    review_id: "r",
    organization_id: "o",
    recipient_id: "p",
    reviewed_at: "2020-01-01",
    rubric_id: null,
    criteria: [],
    outcomes: [],
    evidence_digest: "a".repeat(64),
  };
  const original = await assessmentHash(legacy);
  assert.equal("details" in legacy, false);
  const parsed = assessmentDetailsInput.parse(detail);
  const enhanced: AssessmentManifest = {
    ...legacy,
    schema: 2,
    details: {
      ...parsed,
      challenge_level: "Beginner",
      level_definition: challengeLevelDefinitions.Beginner,
      evaluating_organization: "Fixture organization",
      reviewer_attributed: true,
    },
  };
  const hash = await assessmentHash(enhanced);
  assert.notEqual(hash, original);
  assert.equal(
    await assessmentContextMatches(`Assessed work · sha256:${hash}`, {
      challenge_id: "c",
      challenge_title: legacy.challenge_title,
      context_digest: hash,
      assessment: enhanced,
    }),
    true,
  );
  for (const change of [
    { score: 3 },
    { method: "interview" as const },
    { evaluating_organization: "Other organization" },
    { assessed_on: "2020-01-02" },
  ])
    assert.notEqual(
      await assessmentHash({
        ...enhanced,
        details: { ...enhanced.details!, ...change },
      }),
      hash,
    );
  assert.equal(await assessmentHash(legacy), original);
});
