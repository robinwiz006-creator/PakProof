"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Buffer } from "buffer";
import { getWallets } from "@wallet-standard/app";
import {
  StandardConnect,
  type StandardConnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignMessage,
  type SolanaSignMessageFeature,
} from "@solana/wallet-standard-features";
export function WalletManager({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const [wallet, setWallet] = useState("Phantom"),
    [purpose, setPurpose] = useState("account"),
    [org, setOrg] = useState(organizations[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function link() {
    setBusy(true);
    setMessage("");
    try {
      const w = getWallets()
        .get()
        .find(
          (w) =>
            w.name === wallet &&
            StandardConnect in w.features &&
            SolanaSignMessage in w.features,
        );
      if (!w)
        throw new Error(
          `Enable ${wallet} with message signing support, then reload.`,
        );
      const { accounts } = await (
        w.features[
          StandardConnect
        ] as StandardConnectFeature[typeof StandardConnect]
      ).connect();
      const account = accounts.find((a) => a.chains.includes("solana:devnet"));
      if (!account)
        throw new Error("Choose an account supporting Solana devnet.");
      const start = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "challenge",
          wallet: account.address,
          purpose,
          organization_id: purpose === "account" ? null : org,
        }),
      });
      const challenge = await start.json();
      if (!start.ok) throw new Error(challenge.error);
      setMessage(
        "Review the ownership message in your wallet. This sends no transaction.",
      );
      const [signed] = await (
        w.features[
          SolanaSignMessage
        ] as SolanaSignMessageFeature[typeof SolanaSignMessage]
      ).signMessage({
        account,
        message: new TextEncoder().encode(challenge.message),
      });
      if (!signed) throw new Error("Wallet returned no signature.");
      const saved = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          challenge_id: challenge.id,
          signature: Buffer.from(signed.signature).toString("base64"),
        }),
      });
      const result = await saved.json();
      if (!saved.ok) throw new Error(result.error);
      setMessage(
        "Wallet ownership confirmed for this purpose. No transaction was sent.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not link wallet.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel section-spacer">
      <h2>Link a wallet</h2>
      <p className="muted">
        Your email account stays the same. Prove wallet control with a
        short-lived message. Never enter a seed phrase or private key into
        ProofPak.
      </p>
      <label className="field">
        Wallet
        <select value={wallet} onChange={(e) => setWallet(e.target.value)}>
          <option>Phantom</option>
          <option>Solflare</option>
        </select>
      </label>
      <label className="field">
        Purpose
        <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          <option value="account">
            My account / receive milestone payments
          </option>
          <option value="credential_issuer">
            Organization credential signing
          </option>
          <option value="company_payer">
            Company payment signing (owner only)
          </option>
        </select>
      </label>
      {purpose !== "account" && (
        <label className="field">
          Organization
          <select value={org} onChange={(e) => setOrg(e.target.value)}>
            <option value="">Select organization</option>
            {organizations.map((o) => (
              <option value={o.id} key={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        className="button"
        disabled={busy || (purpose !== "account" && !org)}
        onClick={link}
      >
        {busy ? "Verifying…" : "Connect and prove ownership"}
      </button>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
