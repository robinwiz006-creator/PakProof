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
    .maybeSingle();
  if (error) throw new Error("Profile could not be loaded.");
  if (!profile) return null;
  const [p, a] = await Promise.all([
    db.from("projects").select("*").eq("talent_id", profile.id),
    db
      .from("achievements")
      .select(
        "*, companies(name), blockchain_proofs(*), achievement_claims(*), achievement_evidence(*), achievement_sharing(*)",
      )
      .eq("talent_id", profile.id),
  ]);
  if (p.error || a.error)
    throw new Error("Passport evidence could not be loaded.");
  return { profile, projects: p.data ?? [], achievements: a.data ?? [] };
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
