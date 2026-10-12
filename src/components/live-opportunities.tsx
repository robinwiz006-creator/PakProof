import { isConfigured, supabase } from "@/lib/supabase/server";
import { loadLiveOpportunities } from "@/lib/live-opportunities";
import { OpportunityList } from "@/components/opportunity-list";
export async function LiveOpportunities() {
  const configured = isConfigured();
  const db = configured ? await supabase() : null;
  const { challenges, projects } = await loadLiveOpportunities(db);
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
