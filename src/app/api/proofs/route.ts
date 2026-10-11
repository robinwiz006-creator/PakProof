import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isConfigured, supabase } from "@/lib/supabase/server";
import { canonicalRecord, hashRecord } from "@/lib/proof";
import { checkAnchor } from "@/lib/solana";
export const runtime = "nodejs";
async function authorized(id: string) {
  if (!isConfigured()) throw new Error("Supabase is not connected.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in as a company reviewer.");
  const { data: a, error } = await db
    .from("achievements")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !a) throw new Error("Achievement not found or not accessible.");
  const { data: m } = await db
    .from("company_memberships")
    .select("role")
    .eq("company_id", a.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!m)
    throw new Error(
      "Only this company’s reviewers can anchor the achievement.",
    );
  return { db, a };
}
export async function GET(request: Request) {
  try {
    const id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("achievement"));
    const { a } = await authorized(id);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        {
          error:
            "Proof saving requires a server-only Supabase service-role key. No transaction has been sent.",
        },
        { status: 503 },
      );
    const record = canonicalRecord(a);
    return NextResponse.json(
      { record, hash: await hashRecord(record) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Sign in as an authorized company reviewer to prepare this achievement.",
      },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = z
      .object({
        achievementId: z.string().uuid(),
        signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/),
        issuerWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
      })
      .parse(await request.json());
    const { db, a } = await authorized(body.achievementId);
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: "Server proof storage is not configured." },
        { status: 503 },
      );
    const hash = await hashRecord(canonicalRecord(a));
    const { data: existing } = await db
      .from("blockchain_proofs")
      .select("signature")
      .eq("achievement_id", a.id)
      .maybeSingle();
    if (existing)
      return existing.signature === body.signature
        ? NextResponse.json({ saved: true })
        : NextResponse.json(
            {
              error:
                "An onchain proof is already recorded for this achievement.",
            },
            { status: 409 },
          );
    const proof = await checkAnchor(body.signature, hash, body.issuerWallet);
    if (!proof.valid || !proof.blockTime)
      return NextResponse.json(
        {
          error:
            "No finalized, successful devnet transaction matches this record hash and signer. Wait for finalization and retry.",
        },
        { status: 422 },
      );
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.from("blockchain_proofs").insert({
      achievement_id: a.id,
      signature: body.signature,
      record_hash: hash,
      issuer_wallet: body.issuerWallet,
      network: "devnet",
      anchored_at: new Date(Number(proof.blockTime) * 1000).toISOString(),
    });
    if (error)
      return NextResponse.json(
        {
          error:
            "The transaction exists, but proof storage failed. Keep the signature and retry; do not send another transaction.",
        },
        { status: 409 },
      );
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Invalid achievement, wallet, or transaction signature." },
        { status: 400 },
      );
    return NextResponse.json(
      {
        error:
          "Could not verify or save the proof. Confirm reviewer access and the devnet RPC connection, then retry with the same signature.",
      },
      { status: 503 },
    );
  }
}
