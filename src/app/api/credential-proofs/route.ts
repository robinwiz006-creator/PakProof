import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase, isConfigured } from "@/lib/supabase/server";
import {
  credentialSelect,
  credentialValidity,
  type Credential,
} from "@/lib/credentials";
import {
  credentialClaim,
  credentialHash,
  credentialEvidenceDigest,
} from "@/lib/credential-proof";
import { checkCredentialAnchor } from "@/lib/credential-solana";
import { transactionStatus } from "@/lib/solana";
export const runtime = "nodejs";
async function authorized(id: string) {
  if (!isConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error(
      "Server proof storage is not configured. No transaction should be sent.",
    );
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    throw new Error("Sign in as an authorized organization representative.");
  const { data, error } = await db
    .from("credentials")
    .select(credentialSelect)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Credential not accessible.");
  const c = data as unknown as Credential;
  const { data: member } = await db
    .from("company_memberships")
    .select("role")
    .eq("company_id", c.organizations?.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || c.organizations?.issuer_status !== "authorized")
    throw new Error("Authorized issuer membership required.");
  if (
    c.credential_preferences.acceptance !== "accepted" ||
    credentialValidity(c) !== "Current"
  )
    throw new Error("Only accepted, current credentials can be anchored.");
  if (
    !c.credential_evidence ||
    (await credentialEvidenceDigest(c.credential_evidence)) !==
      c.evidence_digest
  )
    throw new Error("Evidence snapshot mismatch.");
  return { db, c, user };
}
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    const { db, c, user } = await authorized(
      z.uuid().parse(q.get("credential")),
    );
    if (q.has("signature")) {
      const sig = z
        .string()
        .regex(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/)
        .parse(q.get("signature"));
      return NextResponse.json(
        { status: await transactionStatus(sig) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data: existing } = await db
      .from("credential_proofs")
      .select("credential_id")
      .eq("credential_id", c.id)
      .maybeSingle();
    if (existing)
      throw new Error(
        "A proof is already recorded. Open the credential to verify it instead of sending again.",
      );
    const { data: wallets } = await db
      .from("wallet_connections")
      .select("wallet_address")
      .eq("user_id", user.id)
      .eq("organization_id", c.organization_id)
      .eq("purpose", "credential_issuer")
      .is("disconnected_at", null);
    if (!wallets?.length)
      throw new Error(
        "First link a credential-signing wallet in Wallet ownership. A company payment wallet does not grant credential signing permission.",
      );
    const record = credentialClaim(c);
    return NextResponse.json(
      {
        record,
        hash: await credentialHash(record),
        allowedWallets: wallets.map((w) => w.wallet_address),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Unable to prepare credential proof.",
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
        achievementId: z.uuid(),
        claimVersion: z.literal(3),
        signature: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{80,90}$/),
        issuerWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
      })
      .parse(await request.json());
    const { db, c, user } = await authorized(body.achievementId);
    const hash = await credentialHash(credentialClaim(c));
    const { data: existing } = await db
      .from("credential_proofs")
      .select("signature,record_hash,issuer_wallet")
      .eq("credential_id", c.id)
      .maybeSingle();
    if (existing)
      return NextResponse.json(
        existing.signature === body.signature &&
          existing.record_hash === hash &&
          existing.issuer_wallet === body.issuerWallet
          ? { saved: true }
          : { error: "A different proof already exists." },
        {
          status:
            existing.signature === body.signature &&
            existing.record_hash === hash &&
            existing.issuer_wallet === body.issuerWallet
              ? 200
              : 409,
        },
      );
    const { data: ownership } = await db
      .from("wallet_connections")
      .select("created_at,disconnected_at")
      .eq("user_id", user.id)
      .eq("organization_id", c.organization_id)
      .eq("purpose", "credential_issuer")
      .eq("wallet_address", body.issuerWallet);
    if (!ownership?.length)
      throw new Error(
        "This signer has not proved credential wallet ownership.",
      );
    const proof = await checkCredentialAnchor(
      body.signature,
      hash,
      body.issuerWallet,
    );
    if (!proof.valid || !proof.blockTime)
      return NextResponse.json(
        {
          error:
            proof.status === "pending"
              ? "Transaction pending. Retry saving the same signature after finalization."
              : proof.status === "failed"
                ? "Transaction failed. Inspect Explorer before retrying."
                : "No matching finalized proof. Keep this signature; do not send another transaction.",
        },
        { status: 422 },
      );
    const blockMs = Number(proof.blockTime) * 1000;
    if (
      !ownership.some(
        (w) =>
          new Date(w.created_at).getTime() <= blockMs + 1000 &&
          (!w.disconnected_at ||
            new Date(w.disconnected_at).getTime() >= blockMs),
      )
    )
      throw new Error(
        "Wallet ownership was not authorized when this transaction was recorded.",
      );
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await admin.rpc("record_credential_proof", {
      p_credential: c.id,
      p_signature: body.signature,
      p_hash: hash,
      p_wallet: body.issuerWallet,
      p_anchored: new Date(Number(proof.blockTime) * 1000).toISOString(),
    });
    if (error)
      return NextResponse.json(
        {
          error:
            "Transaction verified but saving failed. Preserve the signature and retry saving; do not send again.",
        },
        { status: 409 },
      );
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not verify or store this proof. Check issuer access and retry the original signature.",
      },
      { status: 503 },
    );
  }
}
