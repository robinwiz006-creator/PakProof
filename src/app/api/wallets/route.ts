import { sameRequestOrigin, requestSiteOrigin } from "@/lib/request-origin";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { credentialWorkspace } from "@/lib/credential-data";
import { ownershipMessage, verifyOwnership } from "@/lib/wallet-ownership";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameRequestOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Server wallet verification is not configured.");
    const { db, user } = await credentialWorkspace();
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const body = await request.json();
    if (body.action === "challenge") {
      const v = z
        .object({
          wallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
          purpose: z.enum(["account", "credential_issuer", "company_payer"]),
          organization_id: z.uuid().nullable(),
        })
        .parse(body);
      if ((v.purpose === "account") !== (v.organization_id === null))
        throw new Error("Choose the organization for this wallet purpose.");
      if (v.organization_id) {
        const { data: o } = await db
          .from("organizations")
          .select("company_id,issuer_status")
          .eq("id", v.organization_id)
          .single();
        const { data: m } = await db
          .from("company_memberships")
          .select("role")
          .eq("company_id", o?.company_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (
          !m ||
          (v.purpose === "company_payer" && m.role !== "owner") ||
          (v.purpose === "credential_issuer" &&
            o?.issuer_status !== "authorized")
        )
          throw new Error(
            "You do not have permission to link a wallet for this purpose.",
          );
      }
      const issuedAt = new Date().toISOString(),
        expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const message = ownershipMessage({
        domain: requestSiteOrigin(request),
        userId: user.id,
        wallet: v.wallet,
        purpose: v.purpose,
        organizationId: v.organization_id,
        nonce: randomBytes(32).toString("hex"),
        issuedAt,
        expiresAt,
      });
      const { data, error } = await admin
        .from("wallet_ownership_challenges")
        .insert({
          user_id: user.id,
          wallet_address: v.wallet,
          purpose: v.purpose,
          organization_id: v.organization_id,
          message,
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (error)
        throw new Error(
          "Could not prepare ownership verification. Apply the wallet migration first.",
        );
      return NextResponse.json(
        { id: data.id, message },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const v = z
      .object({
        action: z.literal("verify"),
        challenge_id: z.uuid(),
        signature: z.string().max(128),
      })
      .parse(body);
    const { data: c, error } = await admin
      .from("wallet_ownership_challenges")
      .select("*")
      .eq("id", v.challenge_id)
      .eq("user_id", user.id)
      .single();
    if (
      error ||
      !c ||
      c.consumed_at ||
      new Date(c.expires_at).getTime() <= Date.now() ||
      !verifyOwnership(c.wallet_address, c.message, v.signature)
    )
      throw new Error(
        "Ownership verification failed or expired. Start a new verification.",
      );
    const { error: saveError } = await admin.rpc("record_wallet_connection", {
      p_challenge: c.id,
      p_user: user.id,
      p_signature: v.signature,
    });
    if (saveError)
      throw new Error(
        "This wallet or purpose is already linked, or access changed. Disconnect the existing link explicitly before replacing it.",
      );
    return NextResponse.json({ linked: true });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Wallet verification unavailable.",
      },
      { status: 400 },
    );
  }
}
