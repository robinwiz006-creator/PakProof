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
  saved: boolean;
  internal_note: string | null;
  projects: { id: string; title: string; description: string }[];
  credentials: {
    id: string;
    title: string;
    issuer_name: string;
    validity: string;
  }[];
  achievements: { id: string; title: string; assessed: boolean }[];
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
  for (const key of ["q", "skill", "credentials", "assessed", "saved"])
    if (params[key]) q.set(key, params[key]!);
  return `/portal/company/directory?${q}`;
}
