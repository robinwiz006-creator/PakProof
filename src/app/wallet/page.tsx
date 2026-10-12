import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { PageHeading } from "@/components/ui";
import { ConfirmForm } from "@/components/confirm-form";
import { SubmitButton } from "@/components/forms";
import { WalletManager } from "@/components/wallet-manager";
import { disconnectWallet } from "@/lib/credential-actions";
export const dynamic = "force-dynamic";
export default async function Wallet({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message } = await searchParams;
  const [linkResult, memberResult] = await Promise.all([
    db
      .from("wallet_connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("company_memberships")
      .select("company_id,role")
      .eq("user_id", user.id),
  ]);
  const { data: links, error } = linkResult;
  const members = memberResult.data;
  if (memberResult.error)
    throw new Error("Organization wallet permissions could not be loaded.");
  const { data: orgs } = await db
    .from("organizations")
    .select("id,issuer_status,company_id,companies(name)")
    .in(
      "company_id",
      (members ?? []).map((m) => m.company_id),
    );
  return (
    <div className="container page narrow">
      <PageHeading
        eyebrow="OPTIONAL WALLET"
        title="Wallet ownership"
        description="A wallet is not needed to create or share a passport. Signing credentials and receiving milestone payments use separate permissions."
      />
      <div className="button-row">
        <Link className="text-link" href="/portal/talent/passport">
          My passport
        </Link>
        <Link className="text-link" href="/organizations">
          Organizations
        </Link>
        <Link className="text-link" href="/payments">
          Payment history
        </Link>
        <Link className="text-link" href="/paid-projects?view=mine">
          My paid projects
        </Link>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error ? (
        <p className="notice">
          Wallet management requires the additive wallet migration.
        </p>
      ) : (
        <>
          <WalletManager
            organizations={(orgs ?? []).map((o) => ({
              id: o.id,
              issuerStatus: o.issuer_status,
              role:
                members?.find((m) => m.company_id === o.company_id)?.role ?? "",
              name: (o.companies as unknown as { name: string })?.name ?? o.id,
            }))}
          />
          <section className="section-spacer">
            <h2>Linked wallets</h2>
            {!(links ?? []).length && (
              <p className="muted">
                No linked wallets. Your passport works without one.
              </p>
            )}
            {(links ?? []).map((l) => (
              <article className="panel section-spacer" key={l.id}>
                <p className="hash">{l.wallet_address}</p>
                <p>
                  {l.purpose.replaceAll("_", " ")} ·{" "}
                  {l.disconnected_at ? "Disconnected" : "Active"}
                </p>
                {l.organization_id && (
                  <p className="muted">Organization {l.organization_id}</p>
                )}
                {l.lock_reason && <p className="notice">{l.lock_reason}</p>}
                {!l.disconnected_at && !l.lock_reason && (
                  <details>
                    <summary>Disconnect this wallet link</summary>
                    <p className="muted">
                      This disconnects the ProofPak association. It cannot undo
                      a transaction or hide a public Solana address. To replace
                      it, disconnect first and sign a new ownership message.
                    </p>
                    <ConfirmForm
                      action={disconnectWallet}
                      title="Disconnect wallet association?"
                      message="Existing transactions and proofs remain unchanged. Pending payments may block disconnection. A replacement requires a fresh ownership signature."
                      label="Disconnect association"
                    >
                      <input type="hidden" name="connection_id" value={l.id} />
                      <SubmitButton>Confirm disconnect</SubmitButton>
                    </ConfirmForm>
                  </details>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
