import type { Challenge, Profile, Project } from "./types";
export const demoProfile: Profile = {
  id: "demo",
  slug: "ayesha-khan",
  full_name: "Ayesha Khan",
  headline: "Frontend developer · Turning ideas into thoughtful interfaces",
  university: "NUST, Islamabad",
  location: "Islamabad, Pakistan",
  bio: "Computer science student interested in accessible products. I build with React and use data to understand what people need.",
  skills: ["React", "TypeScript", "Accessibility", "UI design"],
  is_public: true,
};
export const demoChallenges: Challenge[] = [
  {
    id: "demo-dashboard",
    company_id: "demo",
    title: "Build a dashboard people can understand",
    description:
      "Design and build a responsive analytics dashboard for a small business. Help a founder understand sales trends and decide what to do next.",
    skills: ["React", "TypeScript", "Data visualization"],
    difficulty: "Intermediate",
    deadline: "2026-12-15",
    deliverables:
      "A deployed dashboard, a public GitHub repository, and a short explanation of your design decisions. Include accessible charts and a mobile layout.",
    status: "published",
    companies: { name: "Karachi Labs (demo)" },
  },
  {
    id: "demo-data",
    company_id: "demo",
    title: "Find the story in a customer dataset",
    description:
      "Explore a synthetic customer dataset and present three useful insights for a product team. Explain your assumptions and show how you reached your conclusions.",
    skills: ["Python", "Data analysis", "Communication"],
    difficulty: "Beginner",
    deadline: "2026-12-20",
    deliverables:
      "A notebook using synthetic data, three visualizations, and a one-page summary. Do not use private customer information.",
    status: "published",
    companies: { name: "Indus Analytics (demo)" },
  },
  {
    id: "demo-design",
    company_id: "demo",
    title: "Make a better first-time experience",
    description:
      "Prototype an onboarding flow for a budgeting app used by students. Make each step clear, useful, and accessible.",
    skills: ["Figma", "Product design", "UX writing"],
    difficulty: "Intermediate",
    deadline: "2026-12-28",
    deliverables:
      "A clickable prototype, five key screens, and a brief usability testing plan.",
    status: "published",
    companies: { name: "Naya Studio (demo)" },
  },
];
export const demoProjects: Project[] = [
  {
    id: "demo-project",
    talent_id: "demo",
    title: "Campus expense tracker",
    description:
      "A mobile-first budgeting concept for students, with accessible categories and a clear monthly overview. Demonstration project; no company approval or onchain proof has been issued.",
    github_url: "",
    demo_url: "",
    evidence_url: "",
  },
];
