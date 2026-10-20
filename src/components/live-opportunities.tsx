import { isConfigured, supabase } from "@/lib/supabase/server";
import { loadLiveOpportunities } from "@/lib/live-opportunities";
import { OpportunityList } from "@/components/opportunity-list";
import { OpportunityBrowser } from "./opportunity-browser";
import { opportunityItems } from "@/lib/opportunity-discovery";
export async function LiveOpportunities({
  discovery = false,
}: { discovery?: boolean } = {}) {
  const configured = isConfigured();
  const db = configured ? await supabase() : null;
  const { challenges, projects } = await loadLiveOpportunities(
    db,
    undefined,
    discovery,
  );
  if (discovery)
    return (
      <OpportunityBrowser
        configured={configured}
        items={opportunityItems(challenges.items, projects.items)}
        challengesUnavailable={challenges.unavailable}
        projectsUnavailable={projects.unavailable}
      />
    );
  return (
    <OpportunityList
      configured={configured}
      challenges={challenges}
      projects={projects}
    />
  );
}

export function OpportunitiesLoading() {
  return (
    <p className="opportunity-notice" role="status">
      Loading published opportunities…
    </p>
  );
}
