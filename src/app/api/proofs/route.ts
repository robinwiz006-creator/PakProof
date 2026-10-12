import { sameRequestOrigin } from "@/lib/request-origin";
import { canRecoverLegacy } from "@/lib/proof-record";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isConfigured, supabase } from "@/lib/supabase/server";
import {
  canonicalRecord,
  claimV2,
  hashRecord,
  evidenceDigest,
} from "@/lib/proof";
import { checkAnchor, transactionStatus } from "@/lib/solana";
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
async function recordFor(
  db: Awaited<ReturnType<typeof supabase>>,
  a: Parameters<typeof claimV2>[0],
  version: 1 | 2,
) {
  if (version === 1) {
    const { data, error } = await db
      .from("achievement_claims")
      .select("legacy_eligible")
      .eq("achievement_id", a.id)
      .single();
    if (error || !data?.legacy_eligible)
      throw new Error("New achievements require a v2 proof.");
    return canonicalRecord(a);
  }
  const { data, error } = await db
    .from("achievement_claims")
    .select("issuer_name,evidence_digest")
    .eq("achievement_id", a.id)
    .single();
  if (error || !data)
    throw new Error(
      "Apply the passport foundation migration before preparing a new proof.",
    );
  const { data: ev, error: evError } = await db
    .from("achievement_evidence")
    .select("*")
    .eq("achievement_id", a.id)
    .single();
  if (evError || !ev || (await evidenceDigest(ev)) !== data.evidence_digest)
    throw new Error("Approved evidence no longer matches its snapshot.");
  return claimV2(a, data);
}
export async function GET(request: Request) {
  try {
    const id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("achievement"));
    const { db, a } = await authorized(id);
    const sig = new URL(request.url).searchParams.get("signature");
    if (sig) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(sig))
        throw new Error("Invalid signature");
      return NextResponse.json(
        { status: await transactionStatus(sig) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json(
        {
          error:
            "Proof saving requires a server-only Supabase service-role key. No transaction has been sent.",
        },
        { status: 503 },
      );
    const record = await recordFor(db, a, 2);
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
  if (!sameRequestOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = z
      .object({
        achievementId: z.string().uuid(),
        claimVersion: z.union([z.literal(1), z.literal(2)]).default(1),
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
    const record = await recordFor(db, a, body.claimVersion);
    const hash = await hashRecord(record);
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
    const proof = await checkAnchor(
      body.signature,
      hash,
      body.issuerWallet,
      body.claimVersion,
    );
    if (!proof.valid || !proof.blockTime)
      return NextResponse.json(
        {
          error:
            proof.status === "failed"
              ? "The transaction failed on devnet. Check its status before starting again."
              : proof.status === "pending"
                ? "The transaction is still pending. Wait and retry saving the same transaction."
                : "No finalized transaction matches this claim and signer. Retain the signature and check Explorer before sending again.",
        },
        { status: 422 },
      );
    if (body.claimVersion === 1) {
      const { data: legacy, error } = await db
        .from("achievement_claims")
        .select("legacy_eligible,created_at")
        .eq("achievement_id", a.id)
        .single();
      if (
        error ||
        !legacy ||
        !canRecoverLegacy(
          legacy.legacy_eligible,
          legacy.created_at,
          Number(proof.blockTime),
        )
      )
        return NextResponse.json(
          {
            error:
              "This v1 transaction is newer than the upgrade boundary. New transactions must use v2.",
          },
          { status: 422 },
        );
    }
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.from("blockchain_proofs").insert({
      achievement_id: a.id,
      claim_version: body.claimVersion,
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
