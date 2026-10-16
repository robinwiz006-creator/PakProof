"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
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
      : path.startsWith("/portal/talent") || path.startsWith("/my-credentials")
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
        <nav aria-label="Account navigation">{render(secondaryNavigation)}</nav>
      </div>
      <div className="switch">
        <Link
          href={role === "company" ? "/portal/talent" : "/portal/company"}
          onClick={() => remember(role === "company" ? "talent" : "company")}
        >
          {role === "company"
            ? "My personal dashboard"
            : "Organization dashboard"}{" "}
          ↗
        </Link>
      </div>
    </aside>
  );
}
function NavLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      {label}
      <span className="nav-pending" data-pending={pending} role="status">
        {pending ? "Loading…" : ""}
      </span>
    </>
  );
}
