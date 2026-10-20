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
        title="Find opportunities"
        description="Find a challenge or project that fits your skills."
        action={
          <Link className="text-link" href="/portal/talent/activity">
            My Activity →
          </Link>
        }
      />
      <section aria-label="Open opportunities">
        <Suspense fallback={<OpportunitiesLoading />}>
          <LiveOpportunities discovery />
        </Suspense>
      </section>
    </div>
  );
}
