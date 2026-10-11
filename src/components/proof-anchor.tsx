"use client";
import { Buffer } from "buffer";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getWallets } from "@wallet-standard/app";
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
  async function saveProof(sig: string, wallet: string) {
    const result = await fetch("/api/proofs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        achievementId,
        signature: sig,
        issuerWallet: wallet,
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
      if (hash !== data.hash)
        throw new Error("Achievement hash did not match. No transaction sent.");
      const wallet = getWallets()
        .get()
        .find(
          (w) =>
            w.name === preferredWallet &&
            StandardConnect in w.features &&
            SolanaSignTransaction in w.features,
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
          data: Buffer.from(memoFor(hash), "utf8"),
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
        JSON.stringify({ signature: sig, wallet: publicKey.toBase58() }),
      );
      setMessage("Transaction sent. Waiting for devnet finalization…");
      const confirmation = await rpc.confirmTransaction(
        { ...latest, signature: sig },
        "finalized",
      );
      if (confirmation.value.err)
        throw new Error(
          "The devnet transaction failed. Inspect its Explorer details.",
        );
      await saveProof(sig, publicKey.toBase58());
      localStorage.removeItem(`proofpak:pending:${achievementId}`);
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
      await saveProof(sig, address);
      localStorage.removeItem(`proofpak:pending:${achievementId}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h3>Anchor this achievement on Solana</h3>
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
        </select>
      </label>
      <div className="button-row section-spacer">
        <button
          className="button"
          disabled={busy || Boolean(signature)}
          onClick={anchor}
        >
          {busy ? "Working…" : "Connect wallet & anchor"}
        </button>
        <button className="button secondary" disabled={busy} onClick={retry}>
          Retry saving existing transaction
        </button>
      </div>
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
          Transaction signature
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
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
