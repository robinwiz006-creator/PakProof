import { PageHeading, DemoNotice } from "@/components/ui";
import { ChallengeBrowser } from "@/components/challenge-browser";
import { challenges } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Challenges() {
  const items = await challenges();
  return (
    <div className="container page">
      <PageHeading
        eyebrow="EXPLORE CHALLENGES"
        title="Put your skills to work."
        description="Practical briefs. Clear expectations. An opportunity to build something worth showing."
      />
      {!isConfigured() && <DemoNotice />}
      <ChallengeBrowser items={items} />
    </div>
  );
}
