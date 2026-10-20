"use client";
import { useState } from "react";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/forms";
import { disconnectWallet } from "@/lib/credential-actions";
export interface LinkedWallet {
  id: string;
  wallet_address: string;
  purpose: string;
  organization_id: string | null;
  disconnected_at: string | null;
  lock_reason: string | null;
  created_at: string;
}
const purposeNames: Record<string, string> = {
  account: "Personal",
  company_payer: "Organization payments",
  credential_issuer: "Organization credential signing",
};
export function WalletLinks({
  links,
  organizationNames = {},
}: {
  links: LinkedWallet[];
  organizationNames?: Record<string, string>;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <section className="wallet-links section-spacer">
      <h2>Linked wallets</h2>
      {!links.length && (
        <p className="muted">
          No wallets linked yet. You can keep building your profile without one.
        </p>
      )}
      {links.map((link) => (
        <article className="wallet-link-row" key={link.id}>
          <div className="button-row">
            <strong>{purposeNames[link.purpose] ?? link.purpose}</strong>
            <span className="tag">
              {link.disconnected_at ? "Unlinked" : "Ownership verified"}
            </span>
          </div>
          <p className="hash wallet-address">{link.wallet_address}</p>
          {link.organization_id && (
            <p className="muted">
              {organizationNames[link.organization_id] ?? "Organization wallet"}
            </p>
          )}
          <div className="button-row">
            <button
              className="text-link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.wallet_address);
                  setFeedback("Address copied.");
                } catch {
                  setFeedback(
                    "Could not copy. Select and copy the address above.",
                  );
                }
              }}
            >
              Copy address
            </button>
            <a
              className="text-link"
              href={`https://explorer.solana.com/address/${encodeURIComponent(link.wallet_address)}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Solana Explorer ↗
            </a>
          </div>
          <details>
            <summary>
              Wallet details{!link.disconnected_at ? " and unlink" : ""}
            </summary>
            <p className="muted">
              Ownership was confirmed with a signed message on{" "}
              {new Date(link.created_at).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
              . This does not verify your identity or skills. Network: Solana
              devnet.
            </p>
            {link.lock_reason && <p className="notice">{link.lock_reason}</p>}
            {!link.disconnected_at && !link.lock_reason && (
              <>
                <p className="muted">
                  Unlink removes the wallet’s association with ProofPak, not its
                  transaction history. Active work or pending payments may
                  prevent unlinking. A replacement needs a new ownership
                  signature.
                </p>
                <ConfirmForm
                  action={disconnectWallet}
                  title="Unlink this wallet?"
                  message="Existing proofs and transactions remain unchanged. Active work or unresolved payments can block unlinking. Browser disconnection alone does not unlink your wallet."
                  label="Unlink wallet"
                >
                  <input type="hidden" name="connection_id" value={link.id} />
                  <SubmitButton>Unlink wallet</SubmitButton>
                </ConfirmForm>
              </>
            )}
          </details>
        </article>
      ))}
      {feedback && <p role="status">{feedback}</p>}
    </section>
  );
}
