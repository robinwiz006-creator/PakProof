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
  Wallet,
  CreditCard,
} from "lucide-react";
export function PortalNav({
  role,
  section,
}: {
  role: string;
  section: string;
}) {
  const talent = [
    ["", "Dashboard", LayoutDashboard],
    ["passport", "My Passport", UserRound],
    ["projects", "My Projects", FolderGit2],
    ["/my-credentials", "My Credentials", Award],
    ["achievements", "My Achievements", Award],
    ["/opportunities", "Opportunities", Compass],
    ["/wallet", "Wallet (optional)", Wallet],
    ["/payments", "Payments", CreditCard],
    ["submissions", "My submissions", Send],
    ["settings", "Account Settings", UserRound],
    ["profile", "Edit Profile", UserRound],
  ] as const;
  const company = [
    ["", "Dashboard", LayoutDashboard],
    ["/organizations", "Organization / Credentials", Building2],
    ["profile", "Company profile", Building2],
    ["challenges", "Challenges", Compass],
    ["create", "Create challenge", PlusCircle],
    ["reviews", "Review submissions", ListChecks],
    ["/paid-projects?view=company", "Paid Projects", FolderGit2],
    ["/payments", "Payments", CreditCard],
    ["/wallet", "Wallet", Wallet],
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
            className={
              !path.startsWith("/") && section === path ? "active" : ""
            }
            aria-current={
              !path.startsWith("/") && section === path ? "page" : undefined
            }
            href={
              path.startsWith("/")
                ? path
                : `/portal/${role}${path ? `/${path}` : ""}`
            }
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
