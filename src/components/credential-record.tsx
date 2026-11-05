import { issuanceTrustLabel } from "@/lib/issuer-permissions";
import Link from "next/link";
import { credentialDate } from "@/lib/credential-presentation";
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
      <p className="muted">{issuanceTrustLabel(c)}</p>
      <h3>
        <Link href={`/credentials/${c.id}`}>{c.title}</Link>
      </h3>
      <p className="muted">
        Issued by {c.issuer_name} · {credentialDate(c.issue_date)}
      </p>
      <div className="tags">
        <span className="tag">Validity: {credentialValidity(c)}</span>
        <span className="tag">
          Organization{" "}
          {c.organizations?.issuer_status === "authorized"
            ? "approved on ProofPak"
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
      <Link
        className="button secondary credential-view-action"
        href={`/credentials/${c.id}`}
      >
        View Credential
      </Link>
    </article>
  );
}
