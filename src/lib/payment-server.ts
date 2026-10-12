import { PaymentError } from "./payment-error";
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import { connection } from "./solana";
import { DEVNET_GENESIS } from "./proof";
import {
  TEST_USDC_MINT,
  TOKEN_PROGRAM,
  type PaymentIntent,
  type PaymentAttempt,
} from "./payments";
import {
  verifyPaymentSettlement,
  type HistoricalTokenBalance,
} from "./payment-chain";
export function paymentAdmin() {
  if (
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  )
    throw new PaymentError(
      "Server payment storage is not configured. No transaction should be sent.",
    );
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function paymentNetwork() {
  const rpc = connection();
  if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
    throw new PaymentError(
      "Payments are disabled: the RPC is not Solana devnet.",
    );
  const mint = await rpc.getAccountInfo(
    new PublicKey(TEST_USDC_MINT),
    "finalized",
  );
  if (
    !mint ||
    mint.owner.toBase58() !== TOKEN_PROGRAM ||
    mint.data.length !== 82 ||
    mint.data[44] !== 6 ||
    mint.data[45] !== 1
  )
    throw new PaymentError(
      "Payments are disabled: the allowlisted devnet test mint is unavailable or changed.",
    );
  return rpc;
}
export function validateTokenAccount(
  account: { owner: PublicKey; data: Uint8Array } | null,
  wallet: string,
  allowMissing = false,
) {
  if (!account && allowMissing) return;
  if (
    !account ||
    account.owner.toBase58() !== TOKEN_PROGRAM ||
    account.data.length !== 165 ||
    new PublicKey(account.data.slice(0, 32)).toBase58() !== TEST_USDC_MINT ||
    new PublicKey(account.data.slice(32, 64)).toBase58() !== wallet ||
    account.data[108] !== 1
  )
    throw new PaymentError(
      "Token account is missing, frozen, or has an unexpected mint or wallet owner.",
    );
}
export async function reconcilePayment(attemptId: string) {
  const db = paymentAdmin();
  const { data: a, error: aError } = await db
    .from("payment_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();
  if (aError || !a?.signature || !a.signed_base64)
    throw new PaymentError("No registered signed attempt to reconcile.");
  if (a.status === "paid" || a.status === "failed")
    return { status: a.status, note: a.status_note };
  const { data: row, error: iError } = await db
    .from("payment_intents")
    .select("*")
    .eq("id", a.intent_id)
    .single();
  if (iError || !row) throw new PaymentError("Payment intent not found.");
  const i = { ...row, amount_units: String(row.amount_units) } as PaymentIntent;
  const attempt = {
    ...a,
    last_valid_block_height: String(a.last_valid_block_height),
  } as PaymentAttempt;
  const rpc = await paymentNetwork();
  const url = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        a.signature,
        {
          encoding: "base64",
          commitment: "finalized",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new PaymentError(
      "Devnet RPC temporarily unavailable. The outcome is unknown; do not repay.",
    );
  const raw = await response.json();
  if (raw.error)
    throw new PaymentError(
      "Could not retrieve finalized transaction. Do not repay.",
    );
  let status: "paid" | "pending" | "failed" | "needs_review" = "pending",
    note =
      "Outcome unknown. Keep the registered signature; do not send another payment.",
    finalized: string | null = null;
  if (raw.result) {
    const parsed = await rpc.getParsedTransaction(a.signature, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (!parsed)
      throw new PaymentError(
        "Historical parsed transaction unavailable. Do not repay.",
      );
    if (!parsed.meta || !raw.result.meta || raw.result.meta.err === undefined)
      throw new PaymentError(
        "Historical transaction metadata is unavailable. Outcome unknown; do not repay.",
      );
    if (
      parsed.transaction.signatures[0] !== a.signature ||
      (parsed.meta.err === null) !== (raw.result.meta.err === null)
    )
      throw new PaymentError(
        "RPC transaction metadata is inconsistent. Keep the original signature; do not repay.",
      );
    const tx = {
      finalized: true,
      rawBase64: raw.result.transaction[0],
      err: parsed.meta.err,
      accounts: parsed.transaction.message.accountKeys.map((k) => ({
        address: k.pubkey.toBase58(),
        signer: k.signer,
      })),
      instructions: parsed.transaction.message.instructions.map((ins) => ({
        programId: ins.programId.toBase58(),
        parsed: "parsed" in ins ? ins.parsed : undefined,
      })),
      preBalances: (parsed.meta?.preTokenBalances ??
        []) as HistoricalTokenBalance[],
      postBalances: (parsed.meta?.postTokenBalances ??
        []) as HistoricalTokenBalance[],
      blockTime: parsed.blockTime === null ? null : Number(parsed.blockTime),
    };
    const outcome = await verifyPaymentSettlement(i, attempt, tx);
    status = outcome.status;
    note = outcome.note;
    finalized = tx.blockTime
      ? new Date(tx.blockTime * 1000).toISOString()
      : null;
  } else {
    const { value } = await rpc.getSignatureStatuses([a.signature], {
      searchTransactionHistory: true,
    });
    const s = value[0];
    if (s?.confirmationStatus === "finalized" && s.err) {
      status = "failed";
      note = "Finalized transaction failed; no settlement credited.";
    } else if (s) {
      note =
        "Transaction has not finalized. Wait and check the same signature.";
    } else if (
      (await rpc.getBlockHeight("finalized")) >
      BigInt(a.last_valid_block_height)
    ) {
      status = "needs_review";
      note =
        "Signature not found after blockhash expiry. This is not proof of nonpayment. Use an archival RPC or support review; do not repay.";
    }
  }
  const { error } = await db.rpc("record_payment_result", {
    p_attempt: a.id,
    p_status: status,
    p_note: note,
    p_finalized: finalized,
  });
  if (error)
    throw new PaymentError(
      "Chain checked but saving failed. Reconcile this same registered signature; do not repay.",
    );
  return { status, note, signature: a.signature };
}
