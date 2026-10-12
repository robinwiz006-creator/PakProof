import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { paymentAdmin, reconcilePayment } from "@/lib/payment-server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  if (!expected)
    return NextResponse.json(
      { error: "Scheduled reconciliation is not configured." },
      { status: 503 },
    );
  const auth = Buffer.from(`Bearer ${expected}`),
    received = Buffer.from(supplied);
  if (auth.length !== received.length || !timingSafeEqual(auth, received))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = paymentAdmin();
    const { data, error } = await db
      .from("payment_attempts")
      .select("id")
      .in("status", ["registered", "pending", "needs_review"])
      .order("checked_at", { nullsFirst: true })
      .limit(8);
    if (error) throw new Error();
    const results = [];
    for (const a of data ?? []) {
      try {
        results.push({ id: a.id, ...(await reconcilePayment(a.id)) });
      } catch {
        results.push({
          id: a.id,
          status: "unknown",
          note: "RPC or saving unavailable; signature retained.",
        });
      }
    }
    return NextResponse.json({ checked: results.length, results });
  } catch {
    return NextResponse.json(
      {
        error:
          "Reconciliation unavailable. Stored signatures remain unchanged.",
      },
      { status: 503 },
    );
  }
}
