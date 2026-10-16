import Link from "next/link";
import { credentialValidity, type Credential } from "@/lib/credentials";
export function CredentialRecord({
  credential: c,
}: {
  credential: Credential;
}) {
  return (
    <article className="credential-record section-spacer">
      <p className="eyebrow">
        ORGANIZATION-ISSUED · {c.credential_type.replaceAll("_", " ")}
      </p>
      <h3>
        <Link href={`/credentials/${c.id}`}>{c.title} ↗</Link>
      </h3>
      <p className="muted">
        Issued by {c.issuer_name} · {c.issue_date}
      </p>
      <div className="tags">
        <span className="tag">Validity: {credentialValidity(c)}</span>
        <span className="tag">
          Organization{" "}
          {c.organizations?.issuer_status === "authorized"
            ? "approved"
            : c.organizations?.issuer_status === "pending"
              ? "awaiting approval"
              : (c.organizations?.issuer_status ?? "unverified")}
        </span>
        <span className={`tag status-${c.credential_preferences.acceptance}`}>
          {c.credential_preferences.acceptance === "pending"
            ? "Awaiting recipient acceptance"
            : c.credential_preferences.acceptance}
        </span>
      </div>
      <p className="muted section-spacer">
        {c.credential_proofs?.length
          ? "Transaction recorded · open the credential to check integrity. "
          : "Blockchain record not completed. "}
        Organization approval and blockchain integrity are separate checks.
      </p>
    </article>
  );
}
