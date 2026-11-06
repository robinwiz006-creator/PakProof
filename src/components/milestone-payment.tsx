"use client";
import {
  paymentBlocked,
  preparePaymentContext,
  paymentSigning,
  paymentRejection,
  saveSignedPayment,
  clearUnsignedPayment,
  clearSettledPayment,
  paymentLocalRisk,
} from "@/lib/transaction-recovery";
import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Buffer } from "buffer";
import { Connection, Transaction } from "@solana/web3.js";
import { getBase58Decoder } from "@solana/kit";
import { signingWallet, REMOTE_WALLET } from "@/lib/wallet-connection";
import {
  StandardConnect,
  type StandardConnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignTransaction,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import { DEVNET_GENESIS, explorerLink } from "@/lib/proof";
import {
  tokenAmount,
  paymentStatusLabel,
  paymentRecoveryGuidance,
  type PaymentIntent,
  type PaymentAttempt,
} from "@/lib/payments";
async function paymentAction(body: Record<string, unknown>) {
  const r = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function MilestonePayment({
  milestoneId,
  payerWallets,
}: {
  milestoneId: string;
  payerWallets: { id: string; wallet_address: string }[];
}) {
  const [connection, setConnection] = useState(payerWallets[0]?.id ?? ""),
    [walletName, setWalletName] = useState("Phantom"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [prepared, setPrepared] = useState<{
      intent: PaymentIntent;
      attempt: PaymentAttempt;
      recovery?: boolean;
      fee_lamports?: string;
      rent_lamports?: string;
    } | null>(null);
  const router = useRouter();
  async function prepare() {
    setBusy(true);
    setMessage(
      "Checking the approved milestone and preparing the exact payment. Nothing has been signed or sent.",
    );
    try {
      if (paymentBlocked(localStorage, milestoneId))
        throw new Error(
          "This browser saved a signed attempt for this milestone. Recover it in Payment History before preparing another transfer.",
        );
      const result = await paymentAction({
        action: "prepare",
        milestone_id: milestoneId,
        payer_connection_id: connection,
      });
      if (!result.recovery && result.attempt && !result.attempt.signature)
        preparePaymentContext(localStorage, {
          schema: 1,
          attemptId: result.attempt.id,
          intentId: result.intent.id,
          milestoneId,
          recipient: result.intent.recipient_wallet,
          mint: result.intent.mint,
          amount: String(result.intent.amount_units),
          stage: "unsigned",
        });
      setPrepared(result);
      setMessage("Review the amount and destination below before signing.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not prepare payment.");
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!prepared || prepared.recovery || prepared.attempt.signature) return;
    setBusy(true);
    let signedLocally = false;
    try {
      setMessage(
        "Waiting for your wallet. Unlock it and approve the ownership-authorized paying account.",
      );
      const w = await signingWallet(walletName, SolanaSignTransaction);
      if (!w)
        throw new Error(
          `Enable ${walletName} with Wallet Standard transaction signing.`,
        );
      const { accounts } = await (
        w.features[
          StandardConnect
        ] as StandardConnectFeature[typeof StandardConnect]
      ).connect();
      const account = accounts.find(
        (a) =>
          a.address === prepared.intent.payer_wallet &&
          a.chains.includes("solana:devnet"),
      );
      if (!account)
        throw new Error(
          "Select the authorized paying wallet shown in this payment.",
        );
      const rpc = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.devnet.solana.com",
        "finalized",
      );
      if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
        throw new Error("The browser RPC is not devnet. Nothing sent.");
      setMessage(
        "Awaiting your wallet signature. Nothing has been broadcast by ProofPak yet.",
      );
      paymentSigning(localStorage, prepared.attempt.id);
      setPrepared({ ...prepared, recovery: true });
      let signed;
      try {
        [signed] = await (
          w.features[
            SolanaSignTransaction
          ] as SolanaSignTransactionFeature[typeof SolanaSignTransaction]
        ).signTransaction({
          account,
          chain: "solana:devnet",
          transaction: Buffer.from(prepared.attempt.template_base64, "base64"),
        });
      } catch (e) {
        const rejected = paymentRejection(localStorage, prepared.attempt.id, e);
        if (rejected) setPrepared({ ...prepared, recovery: false });
        if (rejected)
          setMessage(
            "Signature rejected. Nothing sent; retry signing or cancel the unsigned preparation.",
          );
        throw e;
      }
      if (!signed) throw new Error("Wallet returned no signed payment.");
      const decoded = Transaction.from(signed.signedTransaction);
      if (!decoded.signature)
        throw new Error("Wallet returned an unsigned transaction.");
      signedLocally = true;
      const signature = getBase58Decoder().decode(decoded.signature);
      const signedBase64 = Buffer.from(signed.signedTransaction).toString(
        "base64",
      );
      setPrepared({ ...prepared, recovery: true });
      saveSignedPayment(
        localStorage,
        prepared.attempt.id,
        signature,
        signedBase64,
      );
      setMessage("Saving the signed attempt before sending…");
      const registration = await paymentAction({
        action: "register",
        attempt_id: prepared.attempt.id,
        signed_base64: signedBase64,
      });
      if (registration.signature !== signature)
        throw new Error("Registration signature mismatch. Nothing broadcast.");
      setPrepared({
        ...prepared,
        recovery: true,
        attempt: {
          ...prepared.attempt,
          signature,
          signed_base64: signedBase64,
          status: "registered",
        },
      });
      setMessage("Registered. Sending the exact signed payment to devnet…");
      const sent = await rpc.sendRawTransaction(signed.signedTransaction, {
        skipPreflight: false,
        maxRetries: BigInt(2),
      });
      if (sent !== signature)
        throw new Error(
          "Unexpected send acknowledgement. Check the registered signature; do not pay again.",
        );
      setMessage(
        "Payment sent. Waiting for independent finalized settlement check…",
      );
      await rpc.confirmTransaction(
        {
          signature,
          blockhash: decoded.recentBlockhash!,
          lastValidBlockHeight: BigInt(
            prepared.attempt.last_valid_block_height,
          ),
        },
        "finalized",
      );
      setMessage(
        "Confirmation received. Server settlement verification pending; this is not yet a verified payment.",
      );
      const result = await paymentAction({
        action: "reconcile",
        attempt_id: prepared.attempt.id,
      });
      setMessage(`${paymentStatusLabel(result.status)}: ${result.note}`);
      if (result.status === "paid") {
        clearSettledPayment(localStorage, {
          id: prepared.attempt.id,
          status: "paid",
          signature,
        });
      }
      router.refresh();
    } catch (e) {
      let uncertain = signedLocally;
      try {
        uncertain = uncertain || paymentBlocked(localStorage, milestoneId);
      } catch {
        uncertain = true;
      }
      setMessage(
        `${e instanceof Error ? e.message : "Payment interrupted."} ${uncertain ? "Outcome unknown or recovery required. Keep the original attempt; do not sign another transfer." : "No transaction was broadcast by ProofPak. You may retry signing or cancel this unsigned preparation."}`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section-spacer">
      <h4>Direct milestone payment</h4>
      <p className="muted">
        Devnet test USDC only. Network fees and token-account rent use devnet
        SOL. Transfers are public on Solana.
      </p>
      {!payerWallets.length ? (
        <p className="notice">
          Link an authorized company payer wallet in Wallet ownership. If
          needed, register this company as an organization first; issuer
          authorization is not needed for payments.
        </p>
      ) : (
        <>
          <label className="field">
            Paying wallet
            <select
              value={connection}
              onChange={(e) => setConnection(e.target.value)}
            >
              {payerWallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.wallet_address}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button secondary"
            disabled={busy}
            onClick={prepare}
          >
            Prepare and review payment
          </button>
        </>
      )}
      {prepared && (
        <div className="panel section-spacer">
          <p>
            {tokenAmount(String(prepared.intent.amount_units))} test USDC ·
            Solana devnet
          </p>
          <p className="hash">Recipient: {prepared.intent.recipient_wallet}</p>
          <p className="muted">
            {prepared.attempt?.signature
              ? "An existing signed payment must be checked, not sent again."
              : `Estimated fee ${prepared.fee_lamports ?? "unknown"} lamports; account rent ${prepared.rent_lamports ?? "unknown"} lamports.`}
          </p>
          {!prepared.recovery && !prepared.attempt.signature && (
            <>
              <label className="field">
                Wallet app
                <select
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                >
                  <option>Phantom</option>
                  <option>Solflare</option>
                  <option value={REMOTE_WALLET}>
                    Existing signing session
                  </option>
                </select>
              </label>
              <button className="button" disabled={busy} onClick={pay}>
                Sign and pay exact amount
              </button>
            </>
          )}
          {prepared.attempt?.signature && (
            <a
              className="text-link"
              href={explorerLink(prepared.attempt.signature)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inspect existing transaction ↗
            </a>
          )}
        </div>
      )}
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
export function PaymentRecovery({
  attempt,
  intentId,
  canCancel = false,
  canResume = false,
}: {
  attempt: Pick<PaymentAttempt, "id" | "signature" | "status"> | null;
  intentId: string;
  canCancel?: boolean;
  canResume?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  const localSigned = useSyncExternalStore(
    (notify) => {
      window.addEventListener("proofpak-recovery", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("proofpak-recovery", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => {
      try {
        return attempt ? paymentLocalRisk(localStorage, attempt.id) : false;
      } catch {
        return true;
      }
    },
    () => false,
  );
  useEffect(() => {
    if (!attempt) return;
    try {
      clearUnsignedPayment(localStorage, { ...attempt, intent_id: intentId });
      clearSettledPayment(localStorage, attempt);
    } catch {
      /* Unknown/corrupt browser state stays protected. */
    }
  }, [attempt, intentId]);
  async function recoverSaved() {
    if (!attempt || !canResume) return;
    setBusy(true);
    try {
      const saved = JSON.parse(
        localStorage.getItem(`proofpak:payment:${attempt.id}`) ?? "null",
      );
      if (!saved?.signed_base64)
        throw new Error(
          "Saved signed bytes are unavailable. Keep the original attempt ID for support.",
        );
      await paymentAction({
        action: "register",
        attempt_id: attempt.id,
        signed_base64: saved.signed_base64,
      });
      setMessage(
        "Original signature saved on the server. Check the original transaction below; no transfer was broadcast by this recovery action.",
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Recovery unavailable. Do not send a replacement.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(mode: "reconcile" | "cancel") {
    setBusy(true);
    try {
      const result = await paymentAction(
        mode === "cancel"
          ? { action: mode, intent_id: intentId }
          : { action: mode, attempt_id: attempt?.id },
      );
      if (
        mode === "cancel" &&
        result.cancelled &&
        result.intent_id === intentId
      ) {
        for (const cancelled of result.unsigned_attempts ?? [])
          clearUnsignedPayment(localStorage, cancelled);
      }
      let retainedRisk = localSigned;
      if (mode === "cancel") {
        try {
          retainedRisk = Boolean(
            attempt && paymentLocalRisk(localStorage, attempt.id),
          );
        } catch {
          retainedRisk = true;
        }
      }
      setMessage(
        mode === "cancel"
          ? retainedRisk
            ? "Server preparation cancelled, but this browser has a signed or uncertain attempt. Recovery required; do not broadcast it or prepare another transfer."
            : "Unsigned preparation cancelled. Its unsigned local context was cleared where confirmed safe. You may prepare again."
          : `${paymentStatusLabel(result.status)}: ${result.note}`,
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not check. Do not repay.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    setBusy(true);
    try {
      const result = await paymentAction({
        action: "resume",
        attempt_id: attempt?.id,
      });
      const rpc = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.devnet.solana.com",
        "finalized",
      );
      if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
        throw new Error("Browser RPC is not devnet. Nothing sent.");
      const sig = await rpc.sendRawTransaction(
        Buffer.from(result.signed_base64, "base64"),
        { skipPreflight: false, maxRetries: BigInt(2) },
      );
      if (sig !== result.signature)
        throw new Error("Unexpected receipt. Check the registered signature.");
      setMessage(
        "Same signed transaction sent. Check and save its existing signature after finalization; no new payment was created.",
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Outcome unknown. Do not repay.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted" role="status">
        {paymentRecoveryGuidance(
          attempt?.status ?? "prepared",
          attempt?.signature ?? null,
        )}
      </p>
      <p className="hash">
        Payment ID: {intentId}
        {attempt ? ` · Attempt: ${attempt.id}` : ""}
      </p>
      {localSigned && attempt?.status === "cancelled" && (
        <p className="notice">
          Recovery required: saved signed bytes belong to a closed preparation.
          Do not broadcast or replace them. Keep the attempt and original
          signature for authorized review.
        </p>
      )}
      {localSigned && !attempt?.signature && (
        <p className="notice">
          Recovery required: a local signing attempt may exist. Preserve its
          original reference; do not prepare or sign a replacement.
        </p>
      )}
      <div className="button-row section-spacer">
        {canResume && !attempt?.signature && attempt?.status === "prepared" && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={recoverSaved}
          >
            Recover saved signed payment
          </button>
        )}
        {attempt?.signature && attempt.status !== "paid" && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => action("reconcile")}
          >
            Check and save existing transaction
          </button>
        )}
        {canResume &&
          attempt?.signature &&
          ["registered", "pending"].includes(attempt.status) && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={resume}
            >
              Resume sending same signed transaction
            </button>
          )}
        {canCancel && !attempt?.signature && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => action("cancel")}
          >
            Cancel unsigned preparation
          </button>
        )}
        {attempt?.signature && (
          <a
            className="text-link"
            href={explorerLink(attempt.signature)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Solana Explorer ↗
          </a>
        )}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
