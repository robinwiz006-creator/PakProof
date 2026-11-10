"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  Home,
  UserRound,
  Compass,
  Activity,
  UsersRound,
  Inbox,
  BadgeCheck,
  Building2,
  Layers3,
  ClipboardCheck,
  Wallet,
  CreditCard,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import {
  personalNavigation,
  organizationNavigation,
  secondaryNavigation,
  personalSection,
  type DashboardRole,
} from "@/lib/dashboard-navigation";
function subscribe(notify: () => void) {
  window.addEventListener("proofpak-workspace", notify);
  return () => window.removeEventListener("proofpak-workspace", notify);
}
function snapshot(): DashboardRole {
  try {
    return sessionStorage.getItem("proofpak:workspace") === "company"
      ? "company"
      : "talent";
  } catch {
    return "talent";
  }
}
function remember(role: DashboardRole) {
  try {
    sessionStorage.setItem("proofpak:workspace", role);
    window.dispatchEvent(new Event("proofpak-workspace"));
  } catch {
    /* Navigation works without storage. */
  }
}
export function useDashboardRole(): DashboardRole {
  const path = usePathname();
  const stored = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "talent" as const,
  );
  const explicit =
    path.startsWith("/portal/company") || path.startsWith("/organizations")
      ? "company"
      : path.startsWith("/portal/talent") ||
          path.startsWith("/my-credentials") ||
          path === "/profile-history"
        ? "talent"
        : null;
  useEffect(() => {
    if (explicit) remember(explicit);
  }, [explicit]);
  return explicit ?? stored;
}
export function PortalNav({ workspace = false }: { workspace?: boolean }) {
  const pathname = usePathname();
  const role = useDashboardRole();
  const primary =
    role === "company" ? organizationNavigation : personalNavigation;
  const current = role === "talent" ? personalSection(pathname) : pathname;
  const render = (links: readonly (readonly [string, string])[]) =>
    links.map(([href, label]) => (
      <Link
        key={href}
        href={href}
        onClick={() => remember(role)}
        className={current === href.split("?")[0] ? "active" : ""}
        aria-current={current === href.split("?")[0] ? "page" : undefined}
      >
        <NavIcon href={href} />
        <NavLabel label={label} />
      </Link>
    ));
  return (
    <aside className={workspace ? "workspace-sidebar" : "sidebar"}>
      <p className="eyebrow">
        {role === "company" ? "ORGANIZATION DASHBOARD" : "MY DASHBOARD"}
      </p>
      <nav
        aria-label={workspace ? "Workspace navigation" : "Portal navigation"}
      >
        {render(primary)}
      </nav>
      <div className="nav-secondary">
        <p className="eyebrow">ACCOUNT</p>
        <nav aria-label="Account navigation">
          {role === "company" &&
            render([["/portal/company/directory", "Find candidates"]])}
          {render(secondaryNavigation)}
        </nav>
      </div>
      <div className="switch dashboard-switch">
        <Link
          href={role === "company" ? "/portal/talent" : "/portal/company"}
          onClick={() => remember(role === "company" ? "talent" : "company")}
        >
          <Building2 size={18} aria-hidden="true" />
          <span>
            {role === "company"
              ? "My personal dashboard"
              : "Organization dashboard"}
          </span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="nav-label">{label}</span>
      <span className="nav-pending" data-pending={pending} role="status">
        {pending ? "Loading…" : ""}
      </span>
    </>
  );
}

function NavIcon({ href }: { href: string }) {
  if (href === "/contact-requests")
    return <Inbox aria-hidden="true" size={18} />;
  if (href === "/portal/company/directory")
    return <UsersRound aria-hidden="true" size={18} />;
  const Icon = href.includes("passport")
    ? UserRound
    : href.includes("opportunities")
      ? Compass
      : href.includes("activity")
        ? Activity
        : href.includes("credentials")
          ? BadgeCheck
          : href.includes("organizations")
            ? Building2
            : href.includes("challenges") || href.includes("paid-projects")
              ? Layers3
              : href.includes("reviews")
                ? ClipboardCheck
                : href.includes("wallet")
                  ? Wallet
                  : href.includes("payments")
                    ? CreditCard
                    : href.includes("settings")
                      ? Settings
                      : Home;
  return <Icon size={18} aria-hidden="true" className="nav-icon" />;
}
