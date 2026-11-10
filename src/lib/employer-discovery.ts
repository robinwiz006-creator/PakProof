import { z } from "zod";
export const directoryInput = z.object({
  q: z.string().trim().max(120).default(""),
  skill: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CandidateCardData = {
  id: string;
  slug: string;
  full_name: string;
  headline: string;
  skills: string[];
  allow_contact_requests: boolean;
  matched_skills?: number;
  matching_projects?: number;
  assessed_matches?: number;
  current_credentials?: number;
  saved_opportunity?: string;
  history?: {
    kind: string;
    organization: string;
    title: string;
    field: string;
    start_date: string;
    end_date: string | null;
    ongoing: boolean;
  }[];
  saved: boolean;
  internal_note: string | null;
  projects: { id: string; title: string; description: string }[];
  credentials: {
    id: string;
    title: string;
    issuer_name: string;
    validity: string;
    credential_type?: string;
    issuer_status?: string;
    trust_level?: string;
    trust_suspended?: boolean;
  }[];
  achievements: {
    id: string;
    title: string;
    assessed: boolean;
    assessment_summary?: { criteria_count: number; outcomes: string[] } | null;
  }[];
};
export function opportunityReference(value: string) {
  if (!value) return { challenge: null, project: null };
  const m = /^(challenge|project):([a-f0-9-]{36})$/.exec(value);
  if (!m || !z.uuid().safeParse(m[2]).success)
    throw new Error("Choose an existing opportunity.");
  return {
    challenge: m[1] === "challenge" ? m[2] : null,
    project: m[1] === "project" ? m[2] : null,
  };
}
export function directoryPageHref(
  company: string,
  params: Record<string, string | undefined>,
  page: number,
) {
  const q = new URLSearchParams({ company, page: String(page) });
  for (const key of [
    "q",
    "skill",
    "credentials",
    "assessed",
    "saved",
    "education",
    "experience",
    "project",
    "category",
    "completed",
    "sort",
    "opportunity",
  ])
    if (params[key]) q.set(key, params[key]!);
  return `/portal/company/directory?${q}`;
}

export const evidenceDirectoryInput = directoryInput.extend({
  skill: z
    .string()
    .trim()
    .max(800)
    .default("")
    .refine((v) => {
      const skills = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return skills.length <= 10 && skills.every((s) => s.length <= 80);
    }, "Use up to ten skills separated by commas."),
  education: z.string().trim().max(120).default(""),
  experience: z.string().trim().max(120).default(""),
  project: z.string().trim().max(120).default(""),
  category: z
    .enum([
      "",
      "degree",
      "course",
      "workshop",
      "bootcamp",
      "hackathon_participation",
      "hackathon_achievement",
      "certification",
      "company_achievement",
    ])
    .default(""),
  sort: z.enum(["name", "relevance"]).default("name"),
  opportunity: z
    .string()
    .max(80)
    .default("")
    .refine((v) => {
      try {
        opportunityReference(v);
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid opportunity."),
});
export function matchingExplanation(
  candidate: Pick<
    CandidateCardData,
    | "matched_skills"
    | "matching_projects"
    | "assessed_matches"
    | "current_credentials"
  >,
) {
  const parts: string[] = [];
  if (candidate.matched_skills)
    parts.push(
      `Matches ${candidate.matched_skills} requested skill${candidate.matched_skills === 1 ? "" : "s"}`,
    );
  if (candidate.assessed_matches)
    parts.push(
      `${candidate.assessed_matches} public assessed achievement${candidate.assessed_matches === 1 ? "" : "s"}`,
    );
  if (candidate.matching_projects)
    parts.push(
      `${candidate.matching_projects} matching public project${candidate.matching_projects === 1 ? "" : "s"}`,
    );
  if (candidate.current_credentials)
    parts.push(
      `${candidate.current_credentials} current published credential${candidate.current_credentials === 1 ? "" : "s"}`,
    );
  return parts.join(" · ");
}
