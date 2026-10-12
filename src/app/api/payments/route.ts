import { sameRequestOrigin } from "@/lib/request-origin";
import { PaymentError } from "@/lib/payment-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { isConfigured, supabase } from "@/lib/supabase/server";
import {
  paymentAdmin,
  paymentNetwork,
  validateTokenAccount,
  reconcilePayment,
} from "@/lib/payment-server";
import {
  tokenAccount,
  buildPaymentTransaction,
  validateSignedPayment,
} from "@/lib/payment-chain";
import type { PaymentIntent, PaymentAttempt } from "@/lib/payments";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!sameRequestOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    if (!isConfigured())
      throw new PaymentError("Supabase payments are not configured.");
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Sign in to manage project payments." },
        { status: 401 },
      );
    const admin = paymentAdmin();
    const body = await request.json();
    if (body.action === "prepare") {
      const v = z
        .object({ milestone_id: z.uuid(), payer_connection_id: z.uuid() })
        .parse(body);
      const { data: m } = await db
        .from("paid_milestones")
        .select("*")
        .eq("id", v.milestone_id)
        .single();
      if (!m) throw new PaymentError("Milestone not available.");
      const { data: p } = await db
        .from("paid_projects")
        .select("*")
        .eq("id", m.project_id)
        .single();
      const { data: member } = await db
        .from("company_memberships")
        .select("role")
        .eq("company_id", p?.company_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (
        member?.role !== "owner" ||
        m.work_status !== "approved" ||
        p?.status !== "active"
      )
        throw new PaymentError(
          "Only company owners may pay approved milestones of accepted projects.",
        );
      const { data: existing } = await db
        .from("payment_intents")
        .select("*")
        .eq("milestone_id", m.id)
        .not("status", "in", "(failed,cancelled)")
        .maybeSingle();
      if (existing && existing.status !== "prepared") {
        const { data: a } = await db
          .from("payment_attempts")
          .select("*")
          .eq("intent_id", existing.id)
          .not("status", "in", "(failed,cancelled)")
          .maybeSingle();
        return NextResponse.json({
          intent: existing,
          attempt: a,
          recovery: true,
        });
      }
      const { data: payer } = await db
        .from("wallet_connections")
        .select("*")
        .eq("id", v.payer_connection_id)
        .eq("user_id", user.id)
        .eq("purpose", "company_payer")
        .is("disconnected_at", null)
        .maybeSingle();
      const { data: org } = payer
        ? await db
            .from("organizations")
            .select("company_id")
            .eq("id", payer.organization_id)
            .single()
        : { data: null };
      if (!payer || org?.company_id !== p.company_id)
        throw new PaymentError(
          "Link a company payer wallet for this company first.",
        );
      const { data: payout } = await db
        .from("paid_payout_authorizations")
        .select("*")
        .eq("id", p.payout_authorization_id)
        .eq("project_id", p.id)
        .eq("worker_id", p.worker_id)
        .maybeSingle();
      if (!payout)
        throw new PaymentError(
          "The worker must explicitly authorize a payout wallet on the project page.",
        );
      const { data: recipient } = await admin
        .from("wallet_connections")
        .select("*")
        .eq("id", payout.wallet_connection_id)
        .eq("user_id", p.worker_id)
        .eq("purpose", "account")
        .is("disconnected_at", null)
        .maybeSingle();
      if (!recipient || recipient.wallet_address !== payout.wallet_address)
        throw new PaymentError("Recipient wallet authorization needs renewal.");
      const rpc = await paymentNetwork();
      const source = await tokenAccount(payer.wallet_address),
        destination = await tokenAccount(recipient.wallet_address);
      const [sourceInfo, destInfo] = await Promise.all([
        rpc.getAccountInfo(new PublicKey(source), "finalized"),
        rpc.getAccountInfo(new PublicKey(destination), "finalized"),
      ]);
      validateTokenAccount(sourceInfo, payer.wallet_address);
      validateTokenAccount(destInfo, recipient.wallet_address, true);
      if (
        Buffer.from(sourceInfo!.data).readBigUInt64LE(64) <
        BigInt(m.amount_units)
      )
        throw new PaymentError(
          "Payer wallet does not have enough devnet test USDC. No payment sent.",
        );
      const { data: intentId, error: prepareError } = await db.rpc(
        "prepare_milestone_payment",
        {
          p_milestone: m.id,
          p_connection: payer.id,
          p_source: source,
          p_destination: destination,
        },
      );
      if (prepareError)
        throw new PaymentError(
          "Could not prepare payment. Check project approval and wallet permissions.",
        );
      const { data: row } = await db
        .from("payment_intents")
        .select("*")
        .eq("id", intentId)
        .single();
      if (!row) throw new PaymentError("Payment intent unavailable.");
      const i = {
        ...row,
        amount_units: String(row.amount_units),
      } as PaymentIntent;
      if (
        i.payer_user_id !== user.id ||
        i.payer_wallet !== payer.wallet_address
      )
        throw new PaymentError(
          "An existing payment is pinned to a different payer. That payer must resolve or cancel its unsigned preparation.",
        );
      if (i.status !== "prepared") {
        const { data: a } = await db
          .from("payment_attempts")
          .select("*")
          .eq("intent_id", i.id)
          .not("status", "in", "(failed,cancelled)")
          .maybeSingle();
        return NextResponse.json({ intent: i, attempt: a, recovery: true });
      }
      const latest = await rpc.getLatestBlockhash("finalized");
      const tx = await buildPaymentTransaction(i, latest);
      const [fee, balance, rent] = await Promise.all([
        rpc.getFeeForMessage(tx.compileMessage(), "finalized"),
        rpc.getBalance(new PublicKey(i.payer_wallet), "finalized"),
        destInfo
          ? Promise.resolve(0n)
          : rpc.getMinimumBalanceForRentExemption(165, "finalized"),
      ]);
      if (fee.value === null || balance < fee.value + rent)
        throw new PaymentError(
          "Payer needs free devnet SOL for network fees and token-account creation. No payment sent. You can cancel the unsigned preparation in Payments.",
        );
      const template = Buffer.from(
        await tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      ).toString("base64");
      const { data: attemptId, error: storeError } = await admin.rpc(
        "store_payment_template",
        {
          p_intent: i.id,
          p_user: user.id,
          p_template: template,
          p_blockhash: latest.blockhash,
          p_height: latest.lastValidBlockHeight.toString(),
        },
      );
      if (storeError)
        throw new PaymentError(
          "Payment is already signed or permissions changed. Inspect Payments; do not pay again.",
        );
      return NextResponse.json({
        intent: i,
        attempt: {
          id: attemptId,
          intent_id: i.id,
          template_base64: template,
          blockhash: latest.blockhash,
          last_valid_block_height: latest.lastValidBlockHeight.toString(),
          signature: null,
          signed_base64: null,
          status: "prepared",
        },
        fee_lamports: fee.value.toString(),
        rent_lamports: rent.toString(),
      });
    }
    if (body.action === "register") {
      const v = z
        .object({
          attempt_id: z.uuid(),
          signed_base64: z.string().min(10).max(1700),
        })
        .parse(body);
      const { data: row } = await db
        .from("payment_attempts")
        .select("*")
        .eq("id", v.attempt_id)
        .single();
      if (!row) throw new PaymentError("Payment attempt not accessible.");
      const a = {
        ...row,
        last_valid_block_height: String(row.last_valid_block_height),
      } as PaymentAttempt;
      const { data: i } = await db
        .from("payment_intents")
        .select("*")
        .eq("id", a.intent_id)
        .single();
      if (!i || i.payer_user_id !== user.id)
        throw new PaymentError(
          "Only the preparing payer may register this signature.",
        );
      const signed = await validateSignedPayment(a, v.signed_base64);
      if (
        a.signature === signed.signature &&
        a.signed_base64 === signed.signedBase64
      )
        return NextResponse.json({
          registered: true,
          signature: signed.signature,
        });
      const rpc = await paymentNetwork();
      if (
        (await rpc.getBlockHeight("finalized")) >
        BigInt(a.last_valid_block_height)
      )
        throw new PaymentError(
          "Unsigned preparation expired. Do not broadcast. Prepare again or cancel its unsigned intent.",
        );
      const { error } = await admin.rpc("register_signed_payment", {
        p_attempt: a.id,
        p_user: user.id,
        p_signature: signed.signature,
        p_signed: signed.signedBase64,
      });
      if (error)
        throw new PaymentError(
          "Could not durably register this attempt. Nothing should be broadcast. Refresh Payments to check whether registration succeeded.",
        );
      return NextResponse.json({
        registered: true,
        signature: signed.signature,
      });
    }
    if (body.action === "resume") {
      const v = z.object({ attempt_id: z.uuid() }).parse(body);
      const { data: a } = await db
        .from("payment_attempts")
        .select("*")
        .eq("id", v.attempt_id)
        .single();
      const { data: i } = a
        ? await db
            .from("payment_intents")
            .select("*")
            .eq("id", a.intent_id)
            .single()
        : { data: null };
      if (
        !a?.signed_base64 ||
        !i ||
        i.payer_user_id !== user.id ||
        !["registered", "pending"].includes(a.status)
      )
        throw new PaymentError(
          "Only the original payer may resume an unresolved registered transaction.",
        );
      const { data: m } = await db
        .from("paid_milestones")
        .select("project_id")
        .eq("id", i.milestone_id)
        .single();
      const { data: p } = m
        ? await db
            .from("paid_projects")
            .select("company_id")
            .eq("id", m.project_id)
            .single()
        : { data: null };
      const { data: member } = await db
        .from("company_memberships")
        .select("role")
        .eq("company_id", p?.company_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (member?.role !== "owner")
        throw new PaymentError(
          "Current company owner permission is required to resume broadcast.",
        );
      const rpc = await paymentNetwork();
      const { value } = await rpc.getSignatureStatuses([a.signature], {
        searchTransactionHistory: true,
      });
      if (
        value[0]?.confirmationStatus === "finalized" ||
        (await rpc.getBlockHeight("finalized")) >
          BigInt(a.last_valid_block_height)
      )
        throw new PaymentError(
          "Check the existing transaction instead. A finalized or expired transaction must not be resent.",
        );
      const signed = await validateSignedPayment(
        { ...a, last_valid_block_height: String(a.last_valid_block_height) },
        a.signed_base64,
      );
      if (signed.signature !== a.signature)
        throw new PaymentError("Registered signature mismatch.");
      return NextResponse.json({
        signature: a.signature,
        signed_base64: a.signed_base64,
      });
    }
    if (body.action === "reconcile") {
      const v = z.object({ attempt_id: z.uuid() }).parse(body);
      const { data: a } = await db
        .from("payment_attempts")
        .select("id")
        .eq("id", v.attempt_id)
        .single();
      if (!a) throw new PaymentError("Payment attempt not accessible.");
      return NextResponse.json(await reconcilePayment(a.id));
    }
    if (body.action === "cancel") {
      const v = z.object({ intent_id: z.uuid() }).parse(body);
      const { error } = await db.rpc("cancel_unsigned_payment", {
        p_intent: v.intent_id,
      });
      if (error)
        throw new PaymentError(
          "Only the worker or a company owner may cancel a preparation with no registered signature.",
        );
      return NextResponse.json({ cancelled: true });
    }
    throw new PaymentError("Unknown payment action.");
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "Invalid payment request."
            : e instanceof PaymentError
              ? e.message
              : "Payment service unavailable. Keep any registered signature and check again; do not send another transfer.",
      },
      { status: 400 },
    );
  }
}
