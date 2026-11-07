import { z } from "zod";
export const assessmentMethods = {
  practical_project: "Practical project",
  code_review: "Code review",
  written_test: "Written test",
  interview: "Interview",
  portfolio_review: "Portfolio review",
} as const;
export const challengeLevelDefinitions: Record<string, string> = {
  Beginner:
    "A bounded task using standard approaches, with guidance where needed.",
  Intermediate:
    "Independent delivery of multi-part work and explanation of decisions.",
  Advanced:
    "Complex constraints, independent judgement and justified trade-offs.",
};
export const assessmentDetailsInput = z
  .object({
    competencies: z.array(z.string().trim().min(2).max(80)).min(1).max(8),
    method: z.enum([
      "practical_project",
      "code_review",
      "written_test",
      "interview",
      "portfolio_review",
    ]),
    summary: z.string().trim().min(20).max(1500),
    score: z.number().int().min(0).max(1000).nullable(),
    score_max: z.number().int().min(1).max(1000).nullable(),
    assessed_on: z.iso.date().nullable(),
  })
  .refine(
    (v) =>
      (v.score === null && v.score_max === null) ||
      (v.score !== null && v.score_max !== null && v.score <= v.score_max),
    {
      message:
        "Provide a whole-number score and maximum together, or leave both empty.",
    },
  )
  .refine(
    (v) =>
      !v.assessed_on || v.assessed_on <= new Date().toISOString().slice(0, 10),
    { message: "Assessment date cannot be in the future." },
  );
export type AssessmentDetails = z.infer<typeof assessmentDetailsInput> & {
  challenge_level: string;
  level_definition: string;
  evaluating_organization: string;
  reviewer_attributed: boolean;
};
export function assessmentDetailsFromForm(form: FormData) {
  if (form.get("assessment_details") !== "on") return null;
  return assessmentDetailsInput.parse({
    competencies: String(form.get("competencies") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    method: form.get("assessment_method"),
    summary: form.get("assessment_summary"),
    score: form.get("assessment_score")
      ? Number(form.get("assessment_score"))
      : null,
    score_max: form.get("assessment_score_max")
      ? Number(form.get("assessment_score_max"))
      : null,
    assessed_on: form.get("assessed_on") || null,
  });
}
