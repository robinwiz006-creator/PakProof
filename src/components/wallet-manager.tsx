"use client";
import { useEffect, useState } from "react";
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
  organizations: {
    id: string;
    name: string;
    issuerStatus?: string;
    role?: string;
  }[];
}) {
  const [wallet, setWallet] = useState("Phantom"),
    [purpose, setPurpose] = useState("account"),
    [org, setOrg] = useState(organizations[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const registry = getWallets();
    function update() {
      setAvailable(
        registry
          .get()
          .filter(
            (w) =>
              StandardConnect in w.features && SolanaSignMessage in w.features,
          )
          .map((w) => w.name),
      );
    }
    update();
    const offRegister = registry.on("register", update),
      offUnregister = registry.on("unregister", update);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);
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
          `No ${wallet} message-signing connection was detected. Enable the extension or open this page inside the wallet app’s browser, then try again.`,
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
      <p className="eyebrow">MESSAGE SIGNING · NO TRANSACTION FEE</p>
      <h2>Connect for a specific purpose</h2>
      <p className="muted">
        Your email account stays the same. Prove wallet control with a
        short-lived message. Never enter a seed phrase or private key into
        ProofPak.
      </p>
      <div className="wallet-methods">
        <h3>Choose a connection method</h3>
        <p>
          <strong>Desktop:</strong> use an enabled Phantom or Solflare extension
          with message signing.
        </p>
        <p>
          <strong>Mobile:</strong> open this exact website in your wallet’s
          in-app browser, sign in with your email, and return to Wallet
          ownership. Phantom’s in-app browser remains supported when it exposes
          the required signing features.
        </p>
        <button
          type="button"
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `${window.location.origin}/wallet`,
              );
              setCopied(true);
            } catch {
              setMessage(
                "Copy the website address from your browser and open /wallet inside your wallet app.",
              );
            }
          }}
        >
          {copied ? "Wallet page URL copied" : "Copy wallet page URL"}
        </button>
        <p className="muted">
          Desktop-to-phone QR pairing is not available in this version. Opening
          a wallet app alone does not connect or prove ownership.
        </p>
        <p className="muted" role="status">
          Detected message-signing wallets:{" "}
          {available.length ? available.join(", ") : "none"}
        </p>
      </div>
      <label className="field">
        Wallet
        <select
          aria-label="Wallet"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        >
          <option>Phantom</option>
          <option>Solflare</option>
        </select>
      </label>
      <label className="field">
        Purpose
        <select
          aria-label="Purpose"
          value={purpose}
          onChange={(e) => {
            const next = e.target.value;
            setPurpose(next);
            setOrg(
              organizations.find((o) =>
                next === "company_payer"
                  ? o.role === "owner"
                  : o.issuerStatus === "authorized",
              )?.id ?? "",
            );
          }}
        >
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
      <p className="wallet-purpose-note">
        {purpose === "account"
          ? "Personal wallet: associate your account and receive approved milestone payments. Your passport needs no wallet."
          : purpose === "company_payer"
            ? "Company payer: an organization owner authorizes this wallet for signing devnet payments. This does not authorize credential issuance."
            : "Credential issuer: an authorized organization member proves control of a signing wallet. Issuer authorization is still checked separately."}
      </p>
      {purpose !== "account" && (
        <label className="field">
          Organization
          <select
            aria-label="Organization"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
          >
            <option value="">Select organization</option>
            {organizations
              .filter((o) =>
                purpose === "company_payer"
                  ? o.role === "owner"
                  : o.issuerStatus === "authorized",
              )
              .map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <ol className="wallet-instructions">
        <li>Connect the account you intend to use.</li>
        <li>Read and sign ProofPak’s short-lived ownership message.</li>
        <li>
          Wait for the server to verify ownership and show the linked wallet.
        </li>
      </ol>
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
