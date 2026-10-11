import { z } from "zod";
export const optionalUrl = z.union([
  z.literal(""),
  z
    .string()
    .url()
    .refine(
      (v) => ["https:", "http:"].includes(new URL(v).protocol),
      "Use an http or https link",
    ),
]);
export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens",
    )
    .min(3)
    .max(60),
  headline: z.string().trim().min(3).max(160),
  university: z.string().trim().max(160),
  location: z.string().trim().max(160),
  bio: z.string().trim().max(2000),
  skills: z.string().max(500),
  is_public: z.boolean(),
});
export const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(3000),
  website: optionalUrl,
  location: z.string().trim().min(2).max(160),
});
export const projectSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(20).max(3000),
    github_url: optionalUrl,
    demo_url: optionalUrl,
    evidence_url: optionalUrl,
  })
  .refine(
    (v) => Boolean(v.github_url || v.demo_url || v.evidence_url),
    "Add at least one evidence link",
  );
export const challengeSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(30).max(10000),
  skills: z.string().trim().min(2).max(500),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) => !isNaN(Date.parse(v)) && Date.parse(v + "T23:59:59Z") > Date.now(),
      "Choose a future deadline",
    ),
  deliverables: z.string().trim().min(20).max(5000),
});
export const submissionSchema = z
  .object({
    challenge_id: z.string().uuid(),
    project_url: optionalUrl,
    github_url: optionalUrl,
    explanation: z.string().trim().min(30).max(10000),
  })
  .refine(
    (v) => Boolean(v.project_url || v.github_url),
    "Add a project or GitHub link",
  );
export const reviewSchema = z.object({
  submission_id: z.string().uuid(),
  decision: z.enum(["approved", "needs_improvement"]),
  feedback: z.string().trim().min(10).max(3000),
});
export function skillsList(text: string) {
  return [
    ...new Set(
      text
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ].slice(0, 20);
}
