"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Fingerprint } from "lucide-react";
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span className="workspace-pending" data-pending={pending} role="status">
      {pending ? "Loading…" : ""}
    </span>
  );
}
export function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const workspace = [
    "/organizations",
    "/my-credentials",
    "/wallet",
    "/payments",
    "/issuer-admin",
  ].some((p) => path === p || path.startsWith(p + "/"));
  if (!workspace) return children;
  const admin = path.startsWith("/issuer-admin");
  const links = admin
    ? [
        ["/issuer-admin", "Issuer review queue"],
        ["/organizations", "My organizations"],
        ["/portal/talent/passport", "My Passport"],
      ]
    : [
        ["/portal/talent", "Overview"],
        ["/portal/talent/passport", "My Passport"],
        ["/portal/talent/projects", "My Projects"],
        ["/my-credentials", "My Credentials"],
        ["/portal/talent/achievements", "My Achievements"],
        ["/opportunities", "Opportunities"],
        ["/paid-projects?view=mine", "My paid work"],
        ["/organizations", "Organization workspace"],
        ["/portal/company", "Challenges workspace"],
        ["/payments", "Payment history"],
        ["/wallet", "Wallet ownership"],
        ["/portal/talent/settings", "Account settings"],
      ];
  return (
    <div className="workspace-frame">
      <aside className="workspace-sidebar">
        <p className="eyebrow">
          <Fingerprint size={16} />
          {admin ? "ADMINISTRATION" : "YOUR WORKSPACE"}
        </p>
        <nav aria-label="Workspace navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                path === href || (href === "/issuer-admin" && admin)
                  ? "page"
                  : undefined
              }
            >
              {label}
              <Pending />
            </Link>
          ))}
        </nav>
        <p className="workspace-note">
          Your passport comes first.
          <br />
          Wallets and opportunities are optional.
        </p>
      </aside>
      <div className="workspace-body">{children}</div>
    </div>
  );
}
