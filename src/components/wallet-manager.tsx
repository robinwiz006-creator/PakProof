"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Buffer } from "buffer";
import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";
import {
  StandardConnect,
  StandardDisconnect,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignMessage,
  type SolanaSignMessageFeature,
} from "@solana/wallet-standard-features";
import { withWalletTimeout } from "@/lib/wallet-session";
import { signingWallet } from "@/lib/wallet-connection";
import type { SelectedWallet } from "@/lib/wallet-phone-support";
export type WalletPurpose = "account" | "company_payer" | "credential_issuer";
const downloads = {
  Phantom: "https://phantom.com/download",
  Solflare: "https://www.solflare.com/download/",
};
export function WalletManager({
  organizations,
  initialPurpose = "account",
  initialOrganization = "",
}: {
  organizations: {
    id: string;
    name: string;
    issuerStatus?: string;
    role?: string;
  }[];
  initialPurpose?: WalletPurpose;
  initialOrganization?: string;
}) {
  const [purpose, setPurpose] = useState<WalletPurpose>(initialPurpose);
  const [org, setOrg] = useState(initialOrganization);
  const [wallet, setWallet] = useState<SelectedWallet | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [session, setSession] = useState<Wallet | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const eligible = organizations.filter((o) =>
    purpose === "company_payer"
      ? o.role === "owner"
      : o.issuerStatus === "authorized",
  );
  const activePurpose = purpose;
  const activeOrg = eligible.some((o) => o.id === org) ? org : "";
  useEffect(() => {
    const registry = getWallets();
    const update = () =>
      setAvailable(
        registry
          .get()
          .filter(
            (w) =>
              StandardConnect in w.features && SolanaSignMessage in w.features,
          )
          .map((w) => w.name),
      );
    update();
    const offRegister = registry.on("register", update),
      offUnregister = registry.on("unregister", update);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);
  async function link(selectedWallet: SelectedWallet) {
    setWallet(selectedWallet);
    setSessionMessage("");
    setLinked(false);
    setBusy(true);
    setMessage("");
    try {
      setMessage(
        `Unlock ${selectedWallet} and approve the connection in your wallet.`,
      );
      const w = await signingWallet(selectedWallet, SolanaSignMessage);
      if (!w)
        throw new Error(
          `${selectedWallet} was not detected. Enable or install it, then retry.`,
        );
      const { accounts } = await withWalletTimeout(
        (
          w.features[
            StandardConnect
          ] as StandardConnectFeature[typeof StandardConnect]
        ).connect(),
      );
      const account = accounts.find((a) => a.chains.includes("solana:devnet"));
      if (!account)
        throw new Error("Choose an account supporting Solana devnet.");
      setSession(w);
      const start = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "challenge",
          wallet: account.address,
          purpose: activePurpose,
          organization_id: activePurpose === "account" ? null : activeOrg,
        }),
      });
      const challenge = await start.json();
      if (!start.ok) throw new Error(challenge.error);
      setMessage(
        "Review the ownership message in your wallet. This sends no transaction.",
      );
      const [signed] = await withWalletTimeout(
        (
          w.features[
            SolanaSignMessage
          ] as SolanaSignMessageFeature[typeof SolanaSignMessage]
        ).signMessage({
          account,
          message: new TextEncoder().encode(challenge.message),
        }),
      );
      if (!signed) throw new Error("Wallet returned no signature.");
      setMessage("Verifying your ownership signature securely with ProofPak…");
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
      if (result.linked !== true)
        throw new Error("ProofPak did not confirm ownership. Please retry.");
      setMessage("Wallet linked. Ownership verified by ProofPak.");
      setLinked(true);
      router.refresh();
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Connection failed.";
      setMessage(
        /reject|declin|cancel|4001/i.test(detail)
          ? "Request declined. Nothing was linked. You can try again when ready."
          : detail,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wallet-connect-section section-spacer">
      <h2>Connect a wallet</h2>
      <fieldset className="wallet-purpose-picker" disabled={busy}>
        <legend>Use this wallet for</legend>
        <label>
          <input
            type="radio"
            name="wallet-context"
            checked={purpose === "account"}
            onChange={() => {
              setPurpose("account");
              setOrg("");
              setLinked(false);
              setMessage("");
            }}
          />{" "}
          Personal
        </label>
        {organizations.length > 0 && (
          <label>
            <input
              type="radio"
              name="wallet-context"
              checked={purpose !== "account"}
              onChange={() => {
                setPurpose("company_payer");
                setOrg("");
                setLinked(false);
                setMessage("");
              }}
            />{" "}
            Organization
          </label>
        )}
      </fieldset>
      {purpose !== "account" && (
        <div className="wallet-context-fields">
          <label className="field">
            Wallet role
            <select
              aria-label="Wallet role"
              value={purpose}
              disabled={busy}
              onChange={(e) => {
                setPurpose(e.target.value as WalletPurpose);
                setOrg("");
                setLinked(false);
                setMessage("");
              }}
            >
              <option value="company_payer">Make organization payments</option>
              <option value="credential_issuer">
                Sign organization credentials
              </option>
            </select>
          </label>
          <label className="field">
            Organization
            <select
              aria-label="Organization"
              value={activeOrg}
              disabled={busy}
              onChange={(e) => {
                setOrg(e.target.value);
                setLinked(false);
                setMessage("");
              }}
            >
              <option value="">Choose an organization</option>
              {eligible.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          {!eligible.length && (
            <p className="notice">
              {purpose === "company_payer"
                ? "Only organization owners can link payment wallets."
                : "Credential signing requires an approved organization you belong to."}
            </p>
          )}
        </div>
      )}
      <p className="muted">
        {purpose === "account"
          ? "Personal · Receive supported payments. Your profile does not need a wallet."
          : purpose === "company_payer"
            ? "Organization payments · Owner permission required. This does not allow credential signing."
            : "Organization credentials · Organization approval and signing permission are checked separately."}
      </p>
      <button
        className="button"
        disabled={busy || (purpose !== "account" && !activeOrg)}
        onClick={() => {
          setWallet(null);
          setMessage("");
          setLinked(false);
          dialog.current?.showModal();
        }}
      >
        Connect Wallet
      </button>
      <dialog
        ref={dialog}
        aria-label={wallet ? `Connect ${wallet}` : "Choose your wallet"}
        aria-busy={busy}
        className="confirmation-dialog wallet-connect-dialog"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <h2>{wallet ? `Connect ${wallet}` : "Choose your wallet"}</h2>
        <p>
          {purpose === "account"
            ? "Personal wallet"
            : `${purpose === "company_payer" ? "Payment" : "Credential signing"} wallet · ${eligible.find((o) => o.id === activeOrg)?.name ?? "Choose organization"}`}
        </p>
        {!wallet ? (
          <div className="wallet-choice-list">
            {(["Phantom", "Solflare"] as const).map((name) => (
              <button
                className="button secondary"
                key={name}
                onClick={() => void link(name)}
              >
                {name}
                <span>
                  {available.includes(name) ? "Available" : "Check connection"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="muted">
              Approve the connection, then sign the ownership message. No
              payment or transaction is sent.
            </p>
            {message && (
              <p
                className={linked ? "success-message" : "notice"}
                role="status"
                aria-live="polite"
              >
                {message}
              </p>
            )}
            {!busy && !linked && (
              <div className="button-row">
                <button className="button" onClick={() => void link(wallet)}>
                  Retry {wallet}
                </button>
                {!available.includes(wallet) && (
                  <a
                    className="button secondary"
                    href={downloads[wallet]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Install {wallet}
                  </a>
                )}
                <button
                  className="text-link"
                  onClick={() => {
                    setWallet(null);
                    setMessage("");
                  }}
                >
                  Choose another wallet
                </button>
              </div>
            )}
          </>
        )}
        <p className="wallet-mobile-help muted">
          On your phone, open ProofPak in Phantom’s or Solflare’s in-app browser
          and connect there. Keep using the same ProofPak account.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => dialog.current?.close()}
        >
          {linked ? "Done" : "Close"}
        </button>
      </dialog>
      {linked && (
        <p className="success-message" role="status">
          Wallet linked. Ownership verified by ProofPak.
        </p>
      )}
      <p className="muted wallet-security-note">
        Sign a message only. Payments currently use devnet test tokens. Never
        enter a recovery phrase or private key.
      </p>
      {session && StandardDisconnect in session.features && (
        <details className="section-spacer">
          <summary>Browser connection</summary>
          <p className="muted">
            Disconnecting this browser session keeps your verified ProofPak
            wallet link.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              try {
                await withWalletTimeout(
                  (
                    session.features[
                      StandardDisconnect
                    ] as StandardDisconnectFeature[typeof StandardDisconnect]
                  ).disconnect(),
                );
                setSession(null);
                setLinked(false);
                setSessionMessage(
                  "Browser session disconnected. Your ProofPak wallet link is unchanged.",
                );
              } catch {
                setSessionMessage(
                  "Could not disconnect. Open your wallet’s connected apps settings to disconnect ProofPak.",
                );
              }
            }}
          >
            Disconnect browser session
          </button>
        </details>
      )}
      {sessionMessage && <p role="status">{sessionMessage}</p>}
    </section>
  );
}
