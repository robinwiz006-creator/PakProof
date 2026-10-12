import Link from "next/link";
import { CredentialAnchor } from "@/components/credential-anchor";
import { PageHeading, Empty } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { CredentialRecord } from "@/components/credential-record";
import { credentialWorkspace } from "@/lib/credential-data";
import {
  organizationTypes,
  credentialTypes,
  credentialSelect,
  type Organization,
  type Credential,
} from "@/lib/credentials";
import {
  registerOrganization,
  issueCredential,
  revokeCredential,
  reviewQualification,
} from "@/lib/credential-actions";
export const dynamic = "force-dynamic";
export default async function Organizations({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message } = await searchParams;
  const { data: members, error: memberError } = await db
    .from("company_memberships")
    .select("company_id,role,companies(id,name)")
    .eq("user_id", user.id);
  const ids = (members ?? []).map((m) => m.company_id);
  const { data: orgs, error } = await db
    .from("organizations")
    .select("*,companies(name,description,website)")
    .in("company_id", ids);
  const organizations = (orgs ?? []) as unknown as Organization[];
  const orgIds = organizations.map((o) => o.id);
  const { data: credentials } = await db
    .from("credentials")
    .select(credentialSelect)
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });
  const { data: requests } = await db
    .from("qualification_requests")
    .select("*")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false });
  const eligible = organizations.filter(
    (o) => o.issuer_status === "authorized",
  );
  return (
    <div className="container page">
      <PageHeading
        eyebrow="PROOFPAK ORGANIZATIONS"
        title="Recognize real learning and work."
        description="Issue credentials through an authorized organization. Challenges remain an optional way to assess skills."
      />
      <div className="button-row">
        <Link className="text-link" href="/portal/talent">
          My passport
        </Link>
        <Link className="text-link" href="/portal/company">
          Challenges workspace
        </Link>
        <Link className="text-link" href="/my-credentials">
          My credentials
        </Link>
        <Link className="text-link" href="/wallet">
          Wallet ownership
        </Link>
      </div>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {(error || memberError) && (
        <p className="notice">
          Organization features are not available until the additive credentials
          migration is applied. Existing passport and challenge pages are
          unchanged.
        </p>
      )}
      <section className="section-spacer">
        <h2>Organization overview</h2>
        {organizations.length ? (
          organizations.map((o) => (
            <article className="panel section-spacer" key={o.id}>
              <h3>{o.companies.name}</h3>
              <p>{o.companies.description}</p>
              <span className="tag">
                {o.organization_type} · Issuer {o.issuer_status}
              </span>
              {o.issuer_status !== "authorized" && (
                <p className="muted">
                  Contact the ProofPak administrator with your official website
                  and evidence that you represent this organization.
                  Registration does not establish trust.
                </p>
              )}
            </article>
          ))
        ) : (
          <Empty title="No organization yet">
            Create one below, or ask an existing organization owner to arrange
            membership with the administrator.
          </Empty>
        )}
      </section>
      <details className="panel section-spacer">
        <summary>Create an organization</summary>
        <form action={registerOrganization}>
          <div className="field">
            <label htmlFor="company_id">
              Use an existing company you own (optional)
            </label>
            <select id="company_id" name="company_id">
              <option value="">Create new organization</option>
              {(members ?? [])
                .filter(
                  (m) =>
                    m.role === "owner" &&
                    !ids
                      .filter((id) =>
                        organizations.some((o) => o.company_id === id),
                      )
                      .includes(m.company_id),
                )
                .map((m) => (
                  <option key={m.company_id} value={m.company_id}>
                    {(m.companies as unknown as { name: string })?.name ??
                      m.company_id}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="orgtype">Organization type</label>
            <select id="orgtype" name="organization_type">
              {organizationTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Field
            name="name"
            label="Official name"
            required
            minLength={2}
            maxLength={120}
          />
          <Field
            name="description"
            label="Description"
            type="textarea"
            required
            minLength={20}
            maxLength={4000}
          />
          <Field name="website" label="Official website" type="url" />
          <SubmitButton>Create organization</SubmitButton>
        </form>
      </details>
      {eligible.length > 0 && (
        <section className="panel section-spacer">
          <h2>Issue a credential</h2>
          <p className="muted">
            Use the slug at the end of an existing recipient’s published
            passport URL. No email search is available. Evidence stays private
            unless the recipient chooses to share it.
          </p>
          <form action={issueCredential}>
            <div className="field">
              <label htmlFor="issuer">Issuing organization</label>
              <select id="issuer" name="organization_id">
                {eligible.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.companies.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="recipient_slug"
              label="Recipient passport slug"
              required
            />
            <Field
              name="title"
              label="Credential title"
              required
              minLength={3}
              maxLength={160}
            />
            <div className="field">
              <label htmlFor="ctype">Credential type</label>
              <select id="ctype" name="credential_type">
                {credentialTypes.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="description"
              label="Description"
              type="textarea"
              required
              minLength={20}
              maxLength={4000}
            />
            <Field name="issue_date" label="Issue date" type="date" required />
            <Field
              name="expiry_date"
              label="Expiry date (optional)"
              type="date"
            />
            <Field
              name="program_name"
              label="Course, program, or event (optional)"
              maxLength={200}
            />
            <Field
              name="award"
              label="Award or rank (optional)"
              maxLength={200}
            />
            <Field
              name="evidence_url"
              label="Supporting evidence URL (optional)"
              type="url"
            />
            <SubmitButton>Issue for recipient acceptance</SubmitButton>
          </form>
        </section>
      )}
      <section className="section-spacer">
        <h2>Issued credentials</h2>
        {(credentials ?? []).length ? (
          (credentials as unknown as Credential[]).map((c) => (
            <div key={c.id}>
              <CredentialRecord credential={c} />
              {c.credential_preferences.acceptance === "accepted" &&
                !c.credential_proofs?.length &&
                !c.credential_events.length &&
                eligible.some((o) => o.id === c.organization_id) && (
                  <CredentialAnchor achievementId={c.id} />
                )}
              {!c.credential_events.length && (
                <details className="panel">
                  <summary>Revoke or correct this credential</summary>
                  <p className="muted">
                    Issued facts cannot be edited. Revoke with a reason, then
                    issue a replacement referencing this credential ID.
                    Revocation does not erase the historical record.
                  </p>
                  <form action={revokeCredential}>
                    <input type="hidden" name="credential_id" value={c.id} />
                    <Field
                      name="reason"
                      label="Reason for revocation or correction"
                      type="textarea"
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                    <SubmitButton>Revoke credential</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          ))
        ) : (
          <p className="muted">No credentials issued.</p>
        )}
      </section>
      <section className="section-spacer">
        <h2>Qualification verification requests</h2>
        <p className="muted">
          Review the original qualification through your institution’s records.
          ProofPak cannot check a university database automatically.
        </p>
        {(requests ?? []).map((r) => (
          <article className="panel section-spacer" key={r.id}>
            <h3>{r.title}</h3>
            <p>{r.description}</p>
            <p className="muted">
              {r.recipient_name} · Recipient ID {r.recipient_id} ·{" "}
              {r.issue_date} · {r.status}
            </p>
            <a
              className="text-link"
              href={r.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Private evidence ↗
            </a>
            {r.status === "pending" &&
              eligible.some((o) => o.id === r.organization_id) && (
                <form action={reviewQualification}>
                  <input type="hidden" name="request_id" value={r.id} />
                  <Field
                    name="feedback"
                    label="Review feedback"
                    type="textarea"
                    required
                    minLength={10}
                    maxLength={2000}
                  />
                  <div className="field">
                    <label htmlFor={`review-${r.id}`}>Decision</label>
                    <select id={`review-${r.id}`} name="decision">
                      <option value="reject">Reject request</option>
                      <option value="approve">
                        Confirm and issue degree credential
                      </option>
                    </select>
                  </div>
                  <SubmitButton>Save institution review</SubmitButton>
                </form>
              )}
            {r.feedback && <p>{r.feedback}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
