import { notFound } from "next/navigation";
import { isConfigured } from "@/lib/supabase/server";
import { CredentialDetailFixture } from "@/components/credential-detail-fixture";
import { WorkspaceFixture } from "@/components/workspace-fixture";
export const dynamic = "force-dynamic";
export default async function TestUI({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  // Isolated component fixtures only. Never available with configured Supabase.
  if (process.env.PROOFPAK_E2E !== "1" || isConfigured()) notFound();
  if ((await searchParams).fixture === "credential")
    return <CredentialDetailFixture />;
  return <WorkspaceFixture />;
}
