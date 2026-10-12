import "server-only";
import type { PaidProject, Milestone } from "./payments";
export function projectData(data: unknown): PaidProject {
  const p = data as PaidProject;
  return { ...p, budget_units: String(p.budget_units) };
}
export function milestoneData(data: unknown): Milestone {
  const m = data as Milestone;
  return { ...m, amount_units: String(m.amount_units) };
}
