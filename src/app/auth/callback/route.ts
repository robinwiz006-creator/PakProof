import { NextResponse } from "next/server";
import { supabase, isConfigured } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code && isConfigured()) {
    const db = await supabase();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("purpose") === "recovery"
            ? "/reset-password"
            : `/portal/${data.user?.user_metadata.preferred_role === "company" ? "company" : "talent"}`,
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/sign-in?message=Email+confirmation+failed.+Use+Resend+confirmation+or+request+a+new+password+reset+link.",
      url.origin,
    ),
  );
}
