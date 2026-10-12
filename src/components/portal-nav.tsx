import Link from "next/link";
import {
  LayoutDashboard,
  UserRound,
  FolderGit2,
  Compass,
  Send,
  Award,
  Building2,
  PlusCircle,
  ListChecks,
  Users,
} from "lucide-react";
export function PortalNav({
  role,
  section,
}: {
  role: string;
  section: string;
}) {
  const talent = [
    ["", "Overview", LayoutDashboard],
    ["passport", "My Passport", UserRound],
    ["projects", "My projects", FolderGit2],
    ["achievements", "My Achievements", Award],
    ["browse", "Explore Challenges", Compass],
    ["submissions", "My submissions", Send],
    ["settings", "Account Settings", UserRound],
    ["profile", "Edit Profile", UserRound],
  ] as const;
  const company = [
    ["", "Overview", LayoutDashboard],
    ["profile", "Company profile", Building2],
    ["create", "Create challenge", PlusCircle],
    ["challenges", "Manage challenges", Compass],
    ["reviews", "Review submissions", ListChecks],
    ["directory", "Talent directory", Users],
  ] as const;
  return (
    <aside className="sidebar">
      <p className="eyebrow">
        {role === "company" ? "PROOFPAK FOR COMPANIES" : "PROOFPAK"}
      </p>
      <nav aria-label="Portal navigation">
        {(role === "company" ? company : talent).map(([path, label, Icon]) => (
          <Link
            key={path}
            className={section === path ? "active" : ""}
            aria-current={section === path ? "page" : undefined}
            href={`/portal/${role}${path ? `/${path}` : ""}`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="switch">
        <Link href={`/portal/${role === "company" ? "talent" : "company"}`}>
          {role === "company" ? "Open talent portal" : "Open company workspace"}{" "}
          ↗
        </Link>
      </div>
    </aside>
  );
}
