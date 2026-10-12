import { notFound } from "next/navigation";
import { isConfigured } from "@/lib/supabase/server";
import { WorkspaceFixture } from "@/components/workspace-fixture";
export const dynamic = "force-dynamic";
export default function TestUI() {
  // Isolated component fixtures only. Never available with configured Supabase.
  if (process.env.PROOFPAK_E2E !== "1" || isConfigured()) notFound();
  return <WorkspaceFixture />;
}
