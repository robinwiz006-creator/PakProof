"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { PortalNav } from "./portal-nav";
import { Fingerprint } from "lucide-react";
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span className="workspace-pending" data-pending={pending} role="status">
      {pending ? "Loading…" : ""}
    </span>
  );
}
export function WorkspaceFrame({
  children,
  signedIn = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
}) {
  const path = usePathname();
  const workspace = [
    "/organizations",
    "/my-credentials",
    "/wallet",
    "/payments",
    "/issuer-admin",
  ].some((p) => path === p || path.startsWith(p + "/"));
  const opportunityWorkspace =
    signedIn &&
    ["/opportunities", "/paid-projects", "/challenges"].some(
      (p) => path === p || path.startsWith(p + "/"),
    );
  if (!workspace && !opportunityWorkspace) return children;
  const admin = path.startsWith("/issuer-admin");
  const links = admin
    ? [
        ["/issuer-admin", "Issuer review queue"],
        ["/organizations", "My organizations"],
        ["/portal/talent/passport", "My Passport"],
      ]
    : [];
  return (
    <div className="workspace-frame">
      {admin ? (
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
      ) : (
        <PortalNav workspace />
      )}
      <div className="workspace-body">{children}</div>
    </div>
  );
}
