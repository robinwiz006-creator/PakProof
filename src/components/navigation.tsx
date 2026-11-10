"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { authHref, navigationAuthContext } from "@/lib/auth-navigation";
import { Menu, X, Fingerprint, ArrowUpRight } from "lucide-react";
import { Suspense, useState } from "react";
export function Navigation({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className={`site-header ${path === "/" ? "marketing-header" : ""}`}>
      <div className="nav-wrap">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <Fingerprint size={24} />
          </span>
          ProofPak<span className="brand-beta">BETA</span>
        </Link>
        <button
          type="button"
          className="mobile-menu"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "open" : ""} aria-label="Main navigation">
          <Link
            aria-current={path === "/opportunities" ? "page" : undefined}
            href="/opportunities"
            onClick={() => setOpen(false)}
          >
            Explore Opportunities
          </Link>
          <Link href="/how-it-works" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link
            href={signedIn ? "/organizations" : "/#organizations"}
            onClick={() => setOpen(false)}
          >
            For Organizations
          </Link>
          {signedIn ? (
            <>
              <Link
                href="/portal/talent/passport"
                onClick={() => setOpen(false)}
              >
                My Profile
              </Link>
              <Link
                className="button small"
                href="/portal/talent"
                onClick={() => setOpen(false)}
              >
                My dashboard <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <Suspense
              fallback={
                <AuthLinks
                  next={navigationAuthContext(path, null)}
                  onNavigate={() => setOpen(false)}
                />
              }
            >
              <ContextualAuthLinks
                path={path}
                onNavigate={() => setOpen(false)}
              />
            </Suspense>
          )}
        </nav>
      </div>
    </header>
  );
}

function ContextualAuthLinks({
  path,
  onNavigate,
}: {
  path: string | null;
  onNavigate: () => void;
}) {
  const params = useSearchParams();
  return (
    <AuthLinks
      next={navigationAuthContext(path, params?.get("next"))}
      onNavigate={onNavigate}
    />
  );
}
function AuthLinks({
  next,
  onNavigate,
}: {
  next: string | null;
  onNavigate: () => void;
}) {
  return (
    <>
      <Link href={authHref("/sign-in", next)} onClick={onNavigate}>
        Log In
      </Link>
      <Link
        className="button small"
        href={authHref("/sign-up", next)}
        onClick={onNavigate}
      >
        Get Started <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </>
  );
}
