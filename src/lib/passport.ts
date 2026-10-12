import type { Profile, Project } from "./types";
export function safeReturnPath(value: string): string | null {
  return /^\/challenges\/[a-f0-9-]{36}(?:#submit)?$/.test(value) ? value : null;
}
export function passportSteps(profile: Profile, projects: Project[]) {
  return [
    {
      label: "Add basic information",
      done: Boolean(profile.full_name && profile.headline),
      href: "/portal/talent/profile",
    },
    {
      label: "Add your skills",
      done: profile.skills.length > 0,
      href: "/portal/talent/profile",
    },
    {
      label: "Add your first project",
      done: projects.length > 0,
      href: "/portal/talent/projects",
    },
    {
      label: "Add supporting evidence",
      done: projects.some((p) => p.github_url || p.demo_url || p.evidence_url),
      href: "/portal/talent/projects",
    },
    {
      label: "Preview your passport",
      done: Boolean(profile.passport_previewed_at),
      href: "/portal/talent/preview",
    },
    {
      label: "Publish and share",
      done: profile.is_public,
      href: "/portal/talent/profile",
    },
  ];
}
