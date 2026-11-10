import { loadSection } from "./section-result";
import { z } from "zod";
import { demoChallenges, demoProfile, demoProjects } from "./demo";
import { isConfigured, supabase } from "./supabase/server";
import type { Achievement, Challenge, Profile, Project } from "./types";
export async function challenges(): Promise<Challenge[]> {
  if (!isConfigured()) return demoChallenges;
  const db = await supabase();
  const { data, error } = await db
    .from("challenges")
    .select("*, companies(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error)
    throw new Error(
      "Challenges could not be loaded. Check the database migration and connection.",
    );
  return data ?? [];
}
export async function challenge(id: string): Promise<Challenge | null> {
  if (!isConfigured()) return demoChallenges.find((c) => c.id === id) ?? null;
  if (!z.string().uuid().safeParse(id).success) return null;
  const db = await supabase();
  const { data, error } = await db
    .from("challenges")
    .select("*, companies(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Challenge could not be loaded.");
  return data;
}
export async function publicPassport(slug: string): Promise<{
  profile: Profile;
  projects: Project[];
  achievements: Achievement[];
  sectionErrors?: { projects?: boolean; achievements?: boolean };
} | null> {
  if (!isConfigured())
    return slug === demoProfile.slug
      ? { profile: demoProfile, projects: demoProjects, achievements: [] }
      : null;
  const db = await supabase();
  const { data: profile, error } = await db
    .from("profiles")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .abortSignal(AbortSignal.timeout(8000))
    .maybeSingle();
  if (error) throw new Error("Profile could not be loaded.");
  if (!profile) return null;
  const [p, a] = await Promise.all([
    loadSection<Project>(() =>
      db
        .from("projects")
        .select("*")
        .eq("talent_id", profile.id)
        .abortSignal(AbortSignal.timeout(8000)),
    ),
    loadSection<Achievement>(() =>
      db
        .from("achievements")
        .select(
          "*, companies(name), blockchain_proofs(*), achievement_claims(*), achievement_evidence(*), achievement_sharing(*)",
        )
        .eq("talent_id", profile.id)
        .abortSignal(AbortSignal.timeout(8000)),
    ),
  ]);
  return {
    profile,
    projects: p.items,
    achievements: a.items,
    sectionErrors: {
      projects: p.state === "unavailable",
      achievements: a.state === "unavailable",
    },
  };
}
export async function achievement(id: string): Promise<Achievement | null> {
  if (!isConfigured() || !z.string().uuid().safeParse(id).success) return null;
  const db = await supabase();
  const { data, error } = await db
    .from("achievements")
    .select(
      "*, profiles(*), companies(name), blockchain_proofs(*), achievement_claims(*), achievement_evidence(*), achievement_sharing(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Achievement could not be loaded.");
  return data;
}
