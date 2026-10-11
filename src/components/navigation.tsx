"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Fingerprint } from "lucide-react";
import { useState } from "react";
export function Navigation() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site-header">
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
            aria-current={path === "/challenges" ? "page" : undefined}
            href="/challenges"
            onClick={() => setOpen(false)}
          >
            Explore challenges
          </Link>
          <Link href="/how-it-works" onClick={() => setOpen(false)}>
            How it works
          </Link>
          <Link href="/portal/company" onClick={() => setOpen(false)}>
            For companies
          </Link>
          <Link href="/sign-in" onClick={() => setOpen(false)}>
            Sign in
          </Link>
          <Link
            className="button small"
            href="/sign-up"
            onClick={() => setOpen(false)}
          >
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
