import type { PaidProject } from "./payments";
export type ProjectListing = Pick<
  PaidProject,
  | "id"
  | "title"
  | "description"
  | "skills"
  | "deadline"
  | "budget_units"
  | "status"
  | "companies"
>;
// Client-side discovery gets listing metadata only, never worker/offer/payout IDs.
export function projectListing(
  row: Omit<ProjectListing, "companies"> & {
    companies?: { name: string } | { name: string }[];
  },
): ProjectListing {
  const company = Array.isArray(row.companies)
    ? row.companies[0]
    : row.companies;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    skills: row.skills,
    deadline: row.deadline,
    budget_units: String(row.budget_units),
    status: row.status,
    companies: company ? { name: company.name } : undefined,
  };
}
