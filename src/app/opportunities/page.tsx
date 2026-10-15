import Link from "next/link";
import { Suspense } from "react";
import {
  LiveOpportunities,
  OpportunitiesLoading,
} from "@/components/live-opportunities";
import { PageHeading } from "@/components/ui";
export default function Opportunities() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="OPTIONAL EXPERIENCE"
        title="Find opportunities"
        description="Find a challenge to practise your skills or apply for a paid project. Your Skill Passport is useful with or without an opportunity."
      />
      <section className="section-spacer">
        <h2>Open opportunities</h2>
        <Suspense fallback={<OpportunitiesLoading />}>
          <LiveOpportunities />
        </Suspense>
      </section>
      <section className="panel section-spacer">
        <p className="eyebrow">SKILL CHALLENGES</p>
        <h2>Show your approach to a practical problem.</h2>
        <p className="muted">
          Companies can review multiple submissions and recognize successful
          work. Challenges are usually unpaid, and you do not need a wallet to
          participate.
        </p>
        <Link className="button section-spacer" href="/challenges">
          Explore skill challenges ↗
        </Link>
      </section>
      <section className="panel section-spacer">
        <p className="eyebrow">PAID PROJECTS · DEVNET MVP</p>
        <h2>Agree on clear work with one company.</h2>
        <p className="muted">
          Apply, accept fixed milestones, submit work and receive company
          review. Approved milestones can be paid in devnet test USDC. Direct
          payments are not guaranteed; these test tokens are not real money.
        </p>
        <div className="button-row section-spacer">
          <Link className="button" href="/paid-projects">
            Explore paid projects ↗
          </Link>
          <Link className="text-link" href="/paid-projects?view=mine">
            My applications and work
          </Link>
        </div>
      </section>
      <p className="muted section-spacer">
        Payment does not automatically verify a skill. Authorized organizations
        can issue credentials separately, and you decide what appears on your
        passport.
      </p>
      <Link className="text-link section-spacer" href="/portal/talent/passport">
        Return to My Profile ↗
      </Link>
    </div>
  );
}
