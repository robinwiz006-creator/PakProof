import "server-only";
import { supabase } from "@/lib/supabase/server";
import {
  loadDashboardAttention,
  loadAdministratorAttention,
  type AttentionContext,
} from "@/lib/dashboard-attention";
import { DashboardAttention } from "./dashboard-attention";
export async function DashboardAttentionData({
  context,
}: {
  context: AttentionContext;
}) {
  const db = await supabase();
  const retryHref =
    context.role === "talent"
      ? "/portal/talent"
      : `/portal/company${context.companyId ? `?company=${context.companyId}` : ""}`;
  const result = await loadDashboardAttention(db, context);
  return <DashboardAttention result={result} retryHref={retryHref} />;
}
export async function AdministratorAttentionData({
  userId,
}: {
  userId: string;
}) {
  const db = await supabase();
  // The parent already gates this page with is_platform_administrator.
  let result;
  try {
    result = await loadAdministratorAttention(db, true, userId);
  } catch {
    result = { items: [], unavailable: ["Independent review permissions"] };
  }
  return <DashboardAttention result={result} retryHref="/issuer-admin" />;
}
