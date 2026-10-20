"use client";
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
      return () => window.removeEventListener("proofpak-pending", notify);
    },
    () => localStorage.getItem(`proofpak:pending:${achievementId}`),
    () => null,
  );
  let stored: {
    signature: string;
    wallet: string;
    claimVersion?: 1 | 2;
  } | null = null;
  try {
    stored = savedPending ? JSON.parse(savedPending) : null;
  } catch {
    stored = null;
  }
  const [failed, setFailed] = useState(false);
  async function inspectStatus() {
    setBusy(true);
    try {
      const sig = signature || stored?.signature;
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
    setMessage("Finalized Solana proof saved.");
    router.refresh();
  }
  async function anchor() {
    setBusy(true);
    setMessage("");
    try {
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
      const [signed] = await signing.signTransaction({
        account,
        chain: "solana:devnet",
        transaction: await tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        }),
      });
      if (!signed) throw new Error("Wallet returned no signed transaction.");
      const sig = await rpc.sendRawTransaction(signed.signedTransaction, {
        skipPreflight: false,
        maxRetries: BigInt(3),
      });
      setSignature(sig);
      localStorage.setItem(
        `proofpak:pending:${achievementId}`,
        JSON.stringify({
          signature: sig,
          wallet: publicKey.toBase58(),
          claimVersion: record.version,
        }),
      );
      window.dispatchEvent(new Event("proofpak-pending"));
      setMessage("Transaction sent. Waiting for devnet finalization…");
      const confirmation = await rpc.confirmTransaction(
        { ...latest, signature: sig },
        "finalized",
      );
      if (confirmation.value.err)
        throw new Error(
          "The devnet transaction failed. Inspect its Explorer details.",
        );
      await saveProof(sig, publicKey.toBase58(), record.version);
      localStorage.removeItem(`proofpak:pending:${achievementId}`);
      window.dispatchEvent(new Event("proofpak-pending"));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not create the proof.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      const pending = localStorage.getItem(`proofpak:pending:${achievementId}`);
      const parsed = pending ? JSON.parse(pending) : null;
      const sig = signature || parsed?.signature;
      const address = walletAddress || parsed?.wallet;
      if (!sig || !address)
        throw new Error(
          "No saved transaction found in this browser. Use the recovery fields below.",
        );
      setSignature(sig);
      setWalletAddress(address);
      await saveProof(sig, address, parsed?.claimVersion ?? claimVersion);
      localStorage.removeItem(`proofpak:pending:${achievementId}`);
      window.dispatchEvent(new Event("proofpak-pending"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Retry failed.");
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
          disabled={busy || Boolean(signature || stored?.signature)}
          onClick={anchor}
        >
          {busy ? "Working…" : "Connect wallet & anchor"}
        </button>
        <button className="button secondary" disabled={busy} onClick={retry}>
          Retry saving existing transaction
        </button>
      </div>
      {stored?.signature && !message && (
        <p className="notice">
          A previously sent transaction needs attention. Retry saving it; do not
          send again.
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
          onClick={() => {
            localStorage.removeItem(`proofpak:pending:${achievementId}`);
            window.dispatchEvent(new Event("proofpak-pending"));
            setSignature("");
            setWalletAddress("");
            setFailed(false);
            setMessage(
              "Failed attempt discarded. You can start a new transaction.",
            );
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
      {signature && (
        <a
          className="text-link"
          href={explorerLink(signature)}
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
