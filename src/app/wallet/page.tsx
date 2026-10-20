import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { PageHeading } from "@/components/ui";
import { WalletManager } from "@/components/wallet-manager";
import { WalletLinks } from "@/components/wallet-links";
import type { WalletPurpose } from "@/components/wallet-manager";
export const dynamic = "force-dynamic";
export default async function Wallet({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    purpose?: string;
    organization?: string;
  }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message, purpose, organization } = await searchParams;
  const [linkResult, memberResult] = await Promise.all([
    db
      .from("wallet_connections")
      .select(
        "id,wallet_address,purpose,organization_id,disconnected_at,lock_reason,created_at",
      )
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
  const { data: orgs, error: organizationError } = await db
    .from("organizations")
    .select("id,issuer_status,company_id,companies(name)")
    .in(
      "company_id",
      (members ?? []).map((m) => m.company_id),
    );
  if (organizationError)
    throw new Error("Organization wallet permissions could not be loaded.");
  const organizations = (orgs ?? []).map((o) => ({
    id: o.id,
    issuerStatus: o.issuer_status,
    role: members?.find((m) => m.company_id === o.company_id)?.role ?? "",
    name: (o.companies as unknown as { name: string })?.name ?? "Organization",
  }));
  const requestedPurpose: WalletPurpose =
    purpose === "company_payer" || purpose === "credential_issuer"
      ? purpose
      : "account";
  const selectedOrganization = organizations.find(
    (o) =>
      o.id === organization &&
      (requestedPurpose === "company_payer"
        ? o.role === "owner"
        : requestedPurpose === "credential_issuer" &&
          o.issuerStatus === "authorized"),
  );
  return (
    <div className="container page narrow">
      <PageHeading
        eyebrow="OPTIONAL WALLET"
        title="My Wallet"
        description="Connect a wallet to receive supported payments and sign blockchain records. A wallet is optional for most ProofPak features."
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
          We couldn’t load your linked wallets. Please try again or contact the
          site administrator.
        </p>
      ) : (
        <>
          <WalletLinks
            links={links ?? []}
            organizationNames={Object.fromEntries(
              organizations.map((o) => [o.id, o.name]),
            )}
          />
          <WalletManager
            key={`${requestedPurpose}:${selectedOrganization?.id ?? ""}`}
            organizations={organizations}
            initialPurpose={requestedPurpose}
            initialOrganization={selectedOrganization?.id ?? ""}
          />
        </>
      )}
    </div>
  );
}
