import { supabase, isConfigured } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { Navigation } from "@/components/navigation";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "ProofPak — Build proof of your skills",
    template: "%s | ProofPak",
  },
  description:
    "A skill passport built through real projects and company challenges. ProofPak for companies helps companies discover talent through evidence.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let signedIn = false;
  if (isConfigured()) {
    const db = await supabase();
    signedIn = Boolean((await db.auth.getUser()).data.user);
  }
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Navigation signedIn={signedIn} />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              ProofPak
            </Link>
            <p>Opportunity starts with evidence.</p>
          </div>
          <div>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/challenges">Explore challenges</Link>
            <span>Solana devnet · Hackathon MVP</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
