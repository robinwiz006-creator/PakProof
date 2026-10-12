import type { SupabaseClient } from "@supabase/supabase-js";

export type LiveChallenge = {
  id: string;
  title: string;
  skills: string[];
  deadline: string;
  companies: { name: string } | null;
};
export type LivePaidProject = LiveChallenge & { budget_units: string | number };
export type OpportunityResult<T> = { items: T[]; unavailable: boolean };

// Explicit public fields and publication filters apply even to signed-in members.
// No demo fallback, applications, contracts, or recipient information is queried.
export async function loadLiveOpportunities(
  db: SupabaseClient | null,
  today = new Date().toISOString().slice(0, 10),
) {
  const empty = { items: [], unavailable: false };
  if (!db)
    return {
      challenges: empty as OpportunityResult<LiveChallenge>,
      projects: empty as OpportunityResult<LivePaidProject>,
    };
  async function read<T>(
    table: string,
    fields: string,
  ): Promise<OpportunityResult<T>> {
    try {
      const { data, error } = await db!
        .from(table)
        .select(fields)
        .eq("status", "published")
        .gte("deadline", today)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) return { items: [], unavailable: true };
      return { items: (data ?? []) as T[], unavailable: false };
    } catch {
      return { items: [], unavailable: true };
    }
  }
  const [challenges, projects] = await Promise.all([
    read<LiveChallenge>(
      "challenges",
      "id,title,skills,deadline,companies(name)",
    ),
    read<LivePaidProject>(
      "paid_projects",
      "id,title,skills,deadline,budget_units,companies(name)",
    ),
  ]);
  return { challenges, projects };
}
