import type { LiveChallenge, LivePaidProject } from "./live-opportunities";
export type OpportunityKind = "all" | "challenge" | "project";
export type OpportunityItem = {
  id: string;
  kind: "challenge" | "project";
  title: string;
  organization: string;
  description: string;
  skills: string[];
  deadline: string;
  budgetUnits?: string;
};
export function shortText(text: string, length = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length).trimEnd()}…` : clean;
}
// A small public DTO: never pass contracts, applicants, wallets or evidence into discovery.
export function opportunityItems(
  challenges: LiveChallenge[],
  projects: LivePaidProject[],
): OpportunityItem[] {
  return [
    ...challenges.map((c) => ({
      id: c.id,
      kind: "challenge" as const,
      title: c.title,
      organization: c.companies?.name ?? "Organization",
      description: shortText(c.description ?? ""),
      skills: c.skills,
      deadline: c.deadline,
    })),
    ...projects.map((p) => ({
      id: p.id,
      kind: "project" as const,
      title: p.title,
      organization: p.companies?.name ?? "Organization",
      description: shortText(p.description ?? ""),
      skills: p.skills,
      deadline: p.deadline,
      budgetUnits: String(p.budget_units),
    })),
  ].sort((a, b) => a.deadline.localeCompare(b.deadline));
}
export function filterOpportunities(
  items: OpportunityItem[],
  query: string,
  kind: OpportunityKind,
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      terms.every((term) =>
        `${item.title} ${item.organization} ${item.description} ${item.skills.join(" ")}`
          .toLowerCase()
          .includes(term),
      ),
  );
}
export function opportunityDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}
