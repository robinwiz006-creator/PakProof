"use client";
import { useEffect, useState, useRef, useSyncExternalStore } from "react";
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
import { withWalletTimeout } from "@/lib/wallet-session";
import {
  phoneConnectionInfo,
  type SelectedWallet,
} from "@/lib/wallet-phone-support";
import { signingWallet } from "@/lib/wallet-connection";
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
  const [wallet, setWallet] = useState<SelectedWallet>("Phantom"),
    [purpose, setPurpose] = useState("account"),
    [org, setOrg] = useState(organizations[0]?.id ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const [linked, setLinked] = useState(false);
  const [connectionView, setConnectionView] = useState<"methods" | "phone">(
    "methods",
  );
  const phone = phoneConnectionInfo(wallet);
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
  // Non-secret intent only. Reown owns the encrypted session; Supabase owns login.
  const restoredIntent = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem("proofpak:wallet-intent");
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [intentEdited, setIntentEdited] = useState(false);
  let restored: { purpose?: string; organization?: string } = {};
  try {
    const parsed = restoredIntent ? JSON.parse(restoredIntent) : null;
    if (parsed && typeof parsed === "object") restored = parsed;
  } catch {
    /* Ignore malformed local preferences. */
  }
  const storedPurpose = [
    "account",
    "company_payer",
    "credential_issuer",
  ].includes(restored.purpose ?? "")
    ? restored.purpose!
    : "account";
  const activePurpose = intentEdited ? purpose : storedPurpose;
  const eligible = organizations.filter((o) =>
    activePurpose === "company_payer"
      ? o.role === "owner"
      : activePurpose === "credential_issuer"
        ? o.issuerStatus === "authorized"
        : true,
  );
  const activeOrg = intentEdited
    ? org
    : (eligible.find((o) => o.id === restored.organization)?.id ??
      eligible[0]?.id ??
      "");
  const router = useRouter();
  async function link(selectedWallet = wallet) {
    try {
      sessionStorage.setItem(
        "proofpak:wallet-intent",
        JSON.stringify({
          purpose: activePurpose,
          organization: activePurpose === "account" ? null : activeOrg,
        }),
      );
    } catch {
      /* Current-page intent remains available when storage is disabled. */
    }
    dialog.current?.close();
    setLinked(false);
    setBusy(true);
    setMessage("");
    try {
      setMessage("Waiting for wallet connection approval…");
      const w = await signingWallet(selectedWallet, SolanaSignMessage);
      if (!w)
        throw new Error(
          `No ${selectedWallet} message-signing connection was detected. Enable the extension or open this page inside the wallet app’s browser, then try again.`,
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
      setMessage(
        "Wallet ownership confirmed for this purpose. No transaction was sent.",
      );
      setLinked(true);
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
      <p className="muted" role="status">
        Detected message-signing wallets:{" "}
        {available.length ? available.join(", ") : "none"}
      </p>
      <p className="muted">
        Choose Phantom or Solflare, then choose its connection method. A
        connection is not a linked wallet until ProofPak verifies your ownership
        signature.
      </p>
      <label className="field">
        Wallet
        <select
          disabled={busy}
          aria-label="Wallet"
          value={wallet}
          onChange={(e) => setWallet(e.target.value as SelectedWallet)}
        >
          <option>Phantom</option>
          <option>Solflare</option>
        </select>
      </label>
      <label className="field">
        Purpose
        <select
          disabled={busy}
          aria-label="Purpose"
          value={activePurpose}
          onChange={(e) => {
            setIntentEdited(true);
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
        {activePurpose === "account"
          ? "Personal wallet: associate your account and receive approved milestone payments. Your passport needs no wallet."
          : activePurpose === "company_payer"
            ? "Company payer: an organization owner authorizes this wallet for signing devnet payments. This does not authorize credential issuance."
            : "Credential issuer: an authorized organization member proves control of a signing wallet. Issuer authorization is still checked separately."}
      </p>
      {activePurpose !== "account" && (
        <label className="field">
          Organization
          <select
            disabled={busy}
            aria-label="Organization"
            value={activeOrg}
            onChange={(e) => {
              setIntentEdited(true);
              setPurpose(activePurpose);
              setOrg(e.target.value);
            }}
          >
            <option value="">Select organization</option>
            {organizations
              .filter((o) =>
                activePurpose === "company_payer"
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
        disabled={busy || (activePurpose !== "account" && !activeOrg)}
        onClick={() => {
          setConnectionView("methods");
          dialog.current?.showModal();
        }}
      >
        {busy ? "Verifying…" : "Connect and prove ownership"}
      </button>
      <dialog
        ref={dialog}
        className="confirmation-dialog wallet-connect-dialog"
        onCancel={() => dialog.current?.close()}
      >
        <h2>
          {connectionView === "phone" ? phone.title : `Connect ${wallet}`}
        </h2>
        <p>
          Purpose:{" "}
          {activePurpose === "account"
            ? "Personal"
            : activePurpose === "company_payer"
              ? "Company payer"
              : "Credential issuer"}
          . No transaction or payment is requested.
        </p>
        {connectionView === "methods" ? (
          <div className="wallet-methods">
            <button
              className="button"
              onClick={() => void link()}
              disabled={busy}
            >
              Connect {wallet} extension
            </button>
            <p>
              Connect the selected wallet directly. Your ownership message is
              verified by ProofPak after you sign it.
            </p>
            <button
              className="button secondary"
              onClick={() => setConnectionView("phone")}
              disabled={busy}
            >
              Connect Phone Wallet
            </button>
            <p className="muted">
              Phone pairing availability depends on {wallet}’s supported
              protocol. No generic wallet list will open.
            </p>
          </div>
        ) : (
          <div className="wallet-methods">
            <p>{phone.message}</p>
            <p>{phone.alternative}</p>
            <button
              className="button"
              onClick={() => void link()}
              disabled={busy}
            >
              Use {wallet} extension
            </button>
            <button
              className="button secondary"
              onClick={() => setConnectionView("methods")}
            >
              Back to {wallet} methods
            </button>
          </div>
        )}
        <button
          className="button secondary"
          onClick={() => dialog.current?.close()}
        >
          Cancel
        </button>
      </dialog>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          try {
            await (
              await import("@/lib/wallet-pairing")
            ).disconnectPairedWallet();
            setLinked(false);
            setMessage(
              "Pairing session disconnected. Saved ProofPak links remain unchanged; remove them explicitly below when allowed.",
            );
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Could not disconnect pairing.",
            );
          }
        }}
      >
        Disconnect pairing session
      </button>
      {linked && (
        <p className="success-message">
          Ownership verified and wallet linked for the selected purpose.
        </p>
      )}
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
