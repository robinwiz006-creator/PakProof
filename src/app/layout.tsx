import { currentUser, isConfigured } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { Navigation } from "@/components/navigation";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "ProofPak — Build proof of your skills",
    template: "%s | ProofPak",
  },
  description:
    "Build your professional identity with a Skill Passport, organization-issued credentials, evidence of your work, and optional opportunities.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let signedIn = false;
  if (isConfigured()) {
    signedIn = Boolean(await currentUser());
  }
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation signedIn={signedIn} />
        <main id="main">
          <WorkspaceFrame signedIn={signedIn}>{children}</WorkspaceFrame>
        </main>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              ProofPak
            </Link>
            <p>
              Skills, credentials, and evidence of your work. One professional
              record.
            </p>
            <p className="footer-disclosure">
              Hackathon MVP · Solana devnet proofs and test-token payments. No
              guaranteed earnings.
            </p>
          </div>
          <div>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/opportunities">Explore Opportunities</Link>
            <Link href="/challenges">Skill Challenges</Link>
            <Link href="/paid-projects">Paid Projects</Link>
            <Link href="/#organizations">For Organizations</Link>
            <span>Solana devnet · Hackathon MVP</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
