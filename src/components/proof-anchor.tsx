"use client";
import {
  captureProof,
  broadcastSavedProof,
  clearSavedProof,
  recoverySnapshot,
  walletRejected,
  type SavedProof,
} from "@/lib/transaction-recovery";
import { Buffer } from "buffer";
import { useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { signingWallet, REMOTE_WALLET } from "@/lib/wallet-connection";
import {
  StandardConnect,
  type StandardConnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignTransaction,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import {
  MEMO_PROGRAM,
  DEVNET_GENESIS,
  hashRecord,
  memoFor,
  explorerLink,
  type AchievementRecord,
} from "@/lib/proof";
export function ProofAnchor({ achievementId }: { achievementId: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [signature, setSignature] = useState(""),
    [walletAddress, setWalletAddress] = useState(""),
    [preferredWallet, setPreferredWallet] = useState("Phantom");
  const router = useRouter();
  const [claimVersion, setClaimVersion] = useState<1 | 2>(2);
  const savedPending = useSyncExternalStore(
    (notify) => {
      window.addEventListener("proofpak-pending", notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener("proofpak-pending", notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => recoverySnapshot(`proofpak:pending:${achievementId}`),
    () => null,
  );
  let stored: {
    signature: string;
    wallet: string;
    claimVersion?: 1 | 2;
    signedBase64?: string;
  } | null = null;
  try {
    stored = savedPending ? JSON.parse(savedPending) : null;
  } catch {
    stored = null;
  }
  const [failedSignature, setFailedSignature] = useState("");
  const failed = Boolean(
    failedSignature && failedSignature === (stored?.signature || signature),
  );
  const setFailed = (value: boolean) =>
    setFailedSignature(value ? stored?.signature || signature : "");
  async function inspectStatus() {
    setBusy(true);
    try {
      const sig = stored?.signature || signature;
      if (!sig) throw new Error("No transaction to check.");
      const r = await fetch(
        `/api/proofs?achievement=${achievementId}&signature=${encodeURIComponent(sig)}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setFailed(data.status === "failed");
      setMessage(
        data.status === "failed"
          ? "Transaction failed. You may discard this failed attempt and start again."
          : data.status === "finalized"
            ? "Transaction finalized. Retry saving this transaction."
            : data.status === "pending"
              ? "Transaction pending. Wait before retrying."
              : "Transaction not found. Keep the signature and inspect Explorer; do not send again yet.",
      );
    } catch {
      setMessage(
        "Could not check the transaction. Keep the signature and try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveProof(
    sig: string,
    wallet: string,
    version: 1 | 2 = claimVersion,
  ) {
    const result = await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        achievementId,
        signature: sig,
        issuerWallet: wallet,
        claimVersion: version,
      }),
    });
    const body = await result.json();
    if (!result.ok) throw new Error(body.error);
    setMessage("Finalized in ProofPak. Server-verified proof saved.");
    router.refresh();
  }
  async function anchor() {
    setBusy(true);
    setMessage("");
    try {
      if (signature || recoverySnapshot(`proofpak:pending:${achievementId}`))
        throw new Error(
          "Recovery required. An existing signing attempt must be resolved first.",
        );
      const response = await fetch(`/api/proofs?achievement=${achievementId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const record = data.record as AchievementRecord;
      const hash = await hashRecord(record);
      setClaimVersion(record.version);
      if (hash !== data.hash)
        throw new Error("Achievement hash did not match. No transaction sent.");
      const wallet = await signingWallet(
        preferredWallet,
        SolanaSignTransaction,
      );
      if (!wallet)
        throw new Error(
          `Install or enable ${preferredWallet} with Wallet Standard support, then reload. No transaction sent.`,
        );
      const connect = wallet.features[
        StandardConnect
      ] as StandardConnectFeature[typeof StandardConnect];
      const signing = wallet.features[
        SolanaSignTransaction
      ] as SolanaSignTransactionFeature[typeof SolanaSignTransaction];
      const { accounts } = await connect.connect();
      const account = accounts.find((a) => a.chains.includes("solana:devnet"));
      if (!account)
        throw new Error(
          "The wallet did not provide an account supporting Solana devnet.",
        );
      const publicKey = new PublicKey(account.address);
      setWalletAddress(account.address);
      const rpc = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.devnet.solana.com",
        "finalized",
      );
      if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
        throw new Error("The configured RPC is not Solana devnet.");
      const latest = await rpc.getLatestBlockhash("finalized");
      const tx = new Transaction({ feePayer: publicKey, ...latest }).add(
        new TransactionInstruction({
          programId: new PublicKey(MEMO_PROGRAM),
          keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
          data: Buffer.from(memoFor(hash, record.version), "utf8"),
        }),
      );
      setMessage("Review the devnet memo transaction in your wallet.");
      setMessage(
        "Awaiting signature. Rejecting the wallet request sends no transaction.",
      );
      const saved = await captureProof(
        localStorage,
        `proofpak:pending:${achievementId}`,
        {
          wallet: account.address,
          claimVersion: record.version,
          hash,
          blockhash: latest.blockhash,
          lastValidBlockHeight: String(latest.lastValidBlockHeight),
        },
        await tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
        async () => {
          const [signed] = await signing.signTransaction({
            account,
            chain: "solana:devnet",
            transaction: await tx.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            }),
          });
          if (!signed)
            throw new Error(
              "Wallet returned no signed transaction. Recovery required.",
            );
          return signed.signedTransaction;
        },
      );
      const sig = saved.signature;
      setSignature(sig);
      setMessage("Signed transaction saved. Submitting the original bytes…");
      await broadcastSavedProof(
        localStorage,
        `proofpak:pending:${achievementId}`,
        rpc,
      );
      setMessage(
        "Broadcast submitted. Confirmation pending; not yet finalized in ProofPak.",
      );
      const confirmation = await rpc.confirmTransaction(
        { ...latest, signature: sig },
        "finalized",
      );
      if (confirmation.value.err)
        throw new Error(
          "The devnet transaction failed. Inspect its Explorer details.",
        );
      setMessage(
        "Transaction finalized on Solana. Matching-claim verification and ProofPak saving are pending…",
      );
      await saveProof(sig, publicKey.toBase58(), record.version);
      clearSavedProof(localStorage, `proofpak:pending:${achievementId}`, sig);
      window.dispatchEvent(new Event("proofpak-pending"));
    } catch (e) {
      setMessage(
        walletRejected(e) &&
          !recoverySnapshot(`proofpak:pending:${achievementId}`)
          ? "Signature rejected. Nothing broadcast by ProofPak. You may try again."
          : `${e instanceof Error ? e.message : "Proof interrupted."} ${recoverySnapshot(`proofpak:pending:${achievementId}`) ? "Outcome unknown or recovery required. Keep the original attempt; do not sign another transaction." : "Nothing was broadcast by ProofPak."}`,
      );
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      let parsed: {
        signature?: string;
        wallet?: string;
        claimVersion?: 1 | 2;
      } | null = null;
      try {
        const pending = localStorage.getItem(
          `proofpak:pending:${achievementId}`,
        );
        parsed = pending ? JSON.parse(pending) : null;
      } catch {
        /* Known manual signatures can still be verified by the server. */
      }
      const sig = parsed?.signature || signature;
      const address = parsed?.wallet || walletAddress;
      if (!sig || !address)
        throw new Error(
          "No saved transaction found in this browser. Use the recovery fields below.",
        );
      setSignature(sig);
      setWalletAddress(address);
      await saveProof(sig, address, parsed?.claimVersion ?? claimVersion);
      clearSavedProof(localStorage, `proofpak:pending:${achievementId}`, sig);
      window.dispatchEvent(new Event("proofpak-pending"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }
  async function resumeOriginal() {
    setBusy(true);
    try {
      const saved = JSON.parse(
        localStorage.getItem(`proofpak:pending:${achievementId}`) ?? "null",
      ) as SavedProof | null;
      if (!saved?.signedBase64 || !saved.signature)
        throw new Error(
          "Original signed bytes unavailable. Check or save the original signature.",
        );
      const response = await fetch(`/api/proofs?achievement=${achievementId}`);
      const current = await response.json();
      if (
        !response.ok ||
        current.hash !== saved.hash ||
        current.record.version !== saved.claimVersion ||
        (current.allowedWallets &&
          !current.allowedWallets.includes(saved.wallet))
      )
        throw new Error(
          "Current claim or signing permission changed. Do not broadcast; recover by checking the original signature.",
        );
      const rpc = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          "https://api.devnet.solana.com",
        "finalized",
      );
      if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
        throw new Error("RPC is not devnet. Nothing sent.");
      const { value } = await rpc.getSignatureStatuses([saved.signature], {
        searchTransactionHistory: true,
      });
      if (
        value[0] ||
        (await rpc.getBlockHeight("finalized")) >
          BigInt(saved.lastValidBlockHeight)
      )
        throw new Error(
          "Transaction seen or blockhash expired. Check and save this signature; no replacement will be signed.",
        );
      await broadcastSavedProof(
        localStorage,
        `proofpak:pending:${achievementId}`,
        rpc,
      );
      setSignature(saved.signature);
      setWalletAddress(saved.wallet);
      setMessage(
        "Original signed transaction submitted. Check and save after finalization. No new transaction was signed.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Outcome unknown. Preserve the original attempt.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h3>Next step: record the approved achievement</h3>
      <p className="muted">
        Connect Phantom or Solflare with devnet SOL. Only an achievement hash is
        included in the memo. Your wallet signs the transaction; ProofPak never
        receives your private key.
      </p>
      <label className="field section-spacer">
        Wallet
        <select
          value={preferredWallet}
          onChange={(e) => setPreferredWallet(e.target.value)}
        >
          <option>Phantom</option>
          <option>Solflare</option>
          <option value={REMOTE_WALLET}>Existing signing session</option>
        </select>
      </label>
      <div className="button-row section-spacer">
        <button
          className="button"
          disabled={busy || Boolean(signature || savedPending)}
          onClick={anchor}
        >
          {busy ? "Working…" : "Connect wallet & anchor"}
        </button>
        <button className="button secondary" disabled={busy} onClick={retry}>
          Retry saving existing transaction
        </button>
      </div>
      {stored?.signedBase64 && (
        <button
          className="button secondary section-spacer"
          disabled={busy}
          onClick={resumeOriginal}
        >
          Resume sending original signed transaction
        </button>
      )}
      {savedPending && !stored?.signature && (
        <p className="notice">
          Recovery required: a signing request was interrupted or browser
          storage is unavailable. Check the wallet and recover its original
          signature below; do not sign a replacement.
        </p>
      )}
      {stored?.signature && !message && (
        <p className="notice">
          A saved signed transaction needs attention. Check or save it; do not
          sign another transaction.
        </p>
      )}
      {(signature || stored?.signature) && (
        <button
          type="button"
          className="text-link section-spacer"
          disabled={busy}
          onClick={inspectStatus}
        >
          Check transaction status
        </button>
      )}
      {failed && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const sig = stored?.signature || signature;
              const r = await fetch(
                `/api/proofs?achievement=${achievementId}&signature=${encodeURIComponent(sig)}`,
              );
              const data = await r.json();
              if (!r.ok || data.status !== "failed")
                throw new Error(
                  "Failure is not finalized. Keep the original signature; do not sign again.",
                );
              clearSavedProof(
                localStorage,
                `proofpak:pending:${achievementId}`,
                sig,
              );
              if (recoverySnapshot(`proofpak:pending:${achievementId}`))
                throw new Error(
                  "A different or unreadable saved attempt remains protected. No replacement is available.",
                );
              setSignature("");
              setWalletAddress("");
              setFailed(false);
              setMessage(
                "Finalized failed attempt cleared. No successful proof was discarded.",
              );
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e.message
                  : "Outcome unknown. Keep the attempt.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Discard failed attempt
        </button>
      )}
      {message && (
        <p className="message section-spacer" role="status">
          {message}
        </p>
      )}
      {(stored?.signature || signature) && (
        <a
          className="text-link"
          href={explorerLink(stored?.signature || signature)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Inspect transaction on Explorer ↗
        </a>
      )}
      <details className="section-spacer">
        <summary>Recover an existing transaction</summary>
        <p className="muted">
          If the transaction succeeded but saving failed, enter its signature
          and signing wallet, then retry saving. This sends no new transaction.
        </p>
        <label className="field section-spacer">
          Claim version
          <select
            value={claimVersion}
            onChange={(e) => setClaimVersion(Number(e.target.value) as 1 | 2)}
          >
            <option value={2}>V2 — new proofs</option>
            <option value={1}>V1 — recover a historical transaction</option>
          </select>
        </label>
        <label className="field section-spacer">
          Transaction signature
          <input
            value={signature}
            onChange={(e) => {
              setSignature(e.target.value);
              setFailed(false);
            }}
          />
        </label>
        <label className="field section-spacer">
          Signing wallet address
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
          />
        </label>
      </details>
    </section>
  );
}
