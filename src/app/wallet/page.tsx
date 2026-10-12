import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { PageHeading } from "@/components/ui";
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
  const { data: links, error } = await db
    .from("wallet_connections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const { data: members } = await db
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", user.id);
  const { data: orgs } = await db
    .from("organizations")
    .select("id,companies(name)")
    .in(
      "company_id",
      (members ?? []).map((m) => m.company_id),
    );
  return (
    <div className="container page narrow">
      <PageHeading
        eyebrow="OPTIONAL WALLET"
        title="Wallet ownership"
        description="A wallet is not needed to create or share a passport. Signing credentials and receiving future payments use separate permissions."
      />
      <div className="button-row">
        <Link className="text-link" href="/portal/talent/passport">
          My passport
        </Link>
        <Link className="text-link" href="/organizations">
          Organizations
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
                {!l.disconnected_at && (
                  <details>
                    <summary>Disconnect this wallet link</summary>
                    <p className="muted">
                      This disconnects the ProofPak association. It cannot undo
                      a transaction or hide a public Solana address. To replace
                      it, disconnect first and sign a new ownership message.
                    </p>
                    <form action={disconnectWallet}>
                      <input type="hidden" name="connection_id" value={l.id} />
                      <SubmitButton>Confirm disconnect</SubmitButton>
                    </form>
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
