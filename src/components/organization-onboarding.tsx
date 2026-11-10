import Link from "next/link";
import type { Organization } from "@/lib/credentials";
import { organizationSetup } from "@/lib/organization-onboarding";
export function OrganizationOnboarding({
  organization: o,
  canEdit,
}: {
  organization: Organization;
  canEdit: boolean;
}) {
  const setup = organizationSetup(o);
  return (
    <section
      className="organization-setup"
      aria-label={`Getting started with ${o.companies.name}`}
    >
      <h3>{o.companies.name}</h3>
      <p className="muted">
        One organization for opportunities, assessments and credentials. Each
        approval has a different purpose.
      </p>
      <ol className="organization-steps">
        {setup.steps.map((s) => (
          <li key={s.title}>
            <strong>{s.title}</strong>
            <span className="tag">{s.status}</span>
            <p className="muted">{s.description}</p>
          </li>
        ))}
      </ol>
      <div className="button-row">
        {canEdit && (
          <Link
            className="button secondary"
            href={`/portal/company/profile?company=${o.company_id}`}
          >
            Edit organization profile
          </Link>
        )}
        <Link
          className="button secondary"
          href={`/portal/company?company=${o.company_id}`}
        >
          Manage opportunities
        </Link>
        <Link className="text-link" href={`#verification-${o.id}`}>
          View verification and requests
        </Link>
        {setup.canIssue && (
          <Link className="button" href="/organizations?view=issue">
            Issue a credential
          </Link>
        )}
      </div>
      {!setup.canIssue && (
        <p className="notice section-spacer">
          You can create challenges and paid projects without credential-issuer
          approval. To issue credentials, ask an independent ProofPak
          administrator to review your category permissions. Registration and
          verification requests do not grant approval automatically.
        </p>
      )}
    </section>
  );
}
