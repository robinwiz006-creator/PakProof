import { credentialLifecycle } from "@/lib/credential-lifecycle";
import { organizationTrust } from "@/lib/organization-trust";
import { CredentialCorrectionNotice } from "./credential-correction";
import { workContext } from "@/lib/challenge-assessment";
import { issuanceTrustLabel } from "@/lib/issuer-permissions";
import Link from "next/link";
import { credentialDate } from "@/lib/credential-presentation";
import { type Credential } from "@/lib/credentials";
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
      <p className="muted">
        Current institutional trust: {organizationTrust(c.organizations).label}
        {c.organizations?.trust_suspended ? " · verification suspended" : ""}
      </p>
      <h3>
        <Link href={`/credentials/${c.id}`}>{c.title}</Link>
      </h3>
      <p className="muted">
        Issued by {c.issuer_name} · {credentialDate(c.issue_date)}
      </p>
      {workContext(c.credential_challenge_context) && (
        <p className="muted">
          Assessed work:{" "}
          {workContext(c.credential_challenge_context)!.challenge_title}
        </p>
      )}
      <div className="tags">
        <span className="tag">Status: {credentialLifecycle(c).status}</span>
        <span className="tag">
          Credential issuance{" "}
          {c.organizations?.issuer_status === "authorized"
            ? "authorized"
            : c.organizations?.issuer_status === "pending"
              ? "awaiting category approval"
              : (c.organizations?.issuer_status ?? "unverified")}
        </span>
        <span className={`tag status-${c.credential_preferences.acceptance}`}>
          {c.credential_preferences.acceptance === "pending"
            ? "Awaiting recipient acceptance"
            : c.credential_preferences.acceptance}
        </span>
      </div>
      <CredentialCorrectionNotice credential={c} />
      <Link
        className="button secondary credential-view-action"
        href={`/credentials/${c.id}`}
      >
        View Credential
      </Link>
    </article>
  );
}
