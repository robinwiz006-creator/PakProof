import { IssuerTypeFields } from "@/components/issuer-type-fields";
import { notFound } from "next/navigation";
import { isConfigured } from "@/lib/supabase/server";
import { CredentialDetailFixture } from "@/components/credential-detail-fixture";
import { OpportunityUXFixture } from "@/components/opportunity-ux-fixture";
import { PortalNav } from "@/components/portal-nav";
import { WorkspaceFixture } from "@/components/workspace-fixture";
export const dynamic = "force-dynamic";
export default async function TestUI({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  // Isolated component fixtures only. Never available with configured Supabase.
  if (process.env.PROOFPAK_E2E !== "1" || isConfigured()) notFound();
  const { fixture } = await searchParams;
  if (fixture === "issuer-permissions")
    return (
      <main className="container page narrow">
        <h1>Isolated issuer permission fixture</h1>
        <p>Offline form only; no organization or credential is created.</p>
        <IssuerTypeFields
          organizations={[
            {
              id: "training-fixture",
              name: "Training fixture",
              types: ["course", "workshop"],
            },
            {
              id: "academic-fixture",
              name: "Academic fixture",
              types: ["degree"],
            },
            { id: "legacy-fixture", name: "Legacy fixture", types: [] },
          ]}
        />
      </main>
    );
  if (fixture === "opportunities") return <OpportunityUXFixture />;
  if (fixture === "navigation")
    return (
      <div className="workspace-frame">
        <PortalNav workspace />
        <div className="workspace-body container page">
          <h1>Shared navigation fixture</h1>
          <p className="notice">
            Offline navigation layout only. No organization or account
            permissions are granted.
          </p>
        </div>
      </div>
    );
  if (fixture === "wallet") return <WorkspaceFixture walletOnly />;
  if (fixture === "inbox") return <CredentialDetailFixture inbox />;
  if (fixture === "credential") return <CredentialDetailFixture />;
  return <WorkspaceFixture />;
}
