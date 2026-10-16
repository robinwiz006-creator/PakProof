import { z } from "zod";
import { skillsList } from "./validation";
export const setupSteps = [
  ["about", "About me"],
  ["skills", "My skills"],
  ["work", "My work and projects"],
  ["publish", "Preview and publish"],
] as const;
export type SetupStep = (typeof setupSteps)[number][0];
export function setupStep(value?: string): SetupStep {
  return setupSteps.some(([step]) => step === value)
    ? (value as SetupStep)
    : "about";
}
/** Explicit per-step whitelists prevent a partial form overwriting unrelated fields. */
export function profileStepPatch(
  step: string,
  values: Record<string, unknown>,
) {
  if (step === "about")
    return z
      .object({
        full_name: z.string().trim().min(2, "Add your name.").max(100),
        headline: z.string().trim().max(160),
        university: z.string().trim().max(160),
        location: z.string().trim().max(160),
        bio: z.string().trim().max(2000),
      })
      .parse(values);
  if (step === "skills")
    return { skills: skillsList(z.string().max(500).parse(values.skills)) };
  if (step === "publish") {
    const v = z
      .object({
        slug: z
          .string()
          .min(3)
          .max(60)
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Use lowercase letters, numbers and single hyphens for your link.",
          ),
        visibility: z.enum(["public", "private"]),
      })
      .parse(values);
    return { slug: v.slug, is_public: v.visibility === "public" };
  }
  throw new Error("Choose a valid profile setup step.");
}
