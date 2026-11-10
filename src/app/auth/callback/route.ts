import { NextResponse } from "next/server";
import { supabase, isConfigured } from "@/lib/supabase/server";
import { emailConfirmationDestination } from "@/lib/auth-flow";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = await emailConfirmationDestination(url.searchParams, {
    configured: isConfigured(),
    exchange: async (code) =>
      (await supabase()).auth.exchangeCodeForSession(code),
  });
  // A relative Location retains the browser origin behind proxies/local bind hosts.
  // destination is built only from fixed routes and the strict opportunity allowlist.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: destination, "Cache-Control": "no-store" },
  });
}
