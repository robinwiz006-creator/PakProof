import Link from "next/link";
import { ConfirmForm } from "@/components/confirm-form";
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
  searchParams: Promise<{ message?: string; view?: string }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message, view: requestedView } = await searchParams;
  const view = ["overview", "issue", "issued", "requests", "register"].includes(
    requestedView ?? "",
  )
    ? requestedView
    : "overview";
  const { data: members, error: memberError } = await db
    .from("company_memberships")
    .select("company_id,role,companies(id,name)")
    .eq("user_id", user.id);
  const ids = (members ?? []).map((m) => m.company_id);
  const { data: orgs, error } = ids.length
    ? await db
        .from("organizations")
        .select("*,companies(name,description,website)")
        .in("company_id", ids)
    : { data: [], error: null };
  const organizations = (orgs ?? []) as unknown as Organization[];
  const orgIds = organizations.map((o) => o.id);
  const [credentialResult, requestResult] = await Promise.all([
    orgIds.length
      ? db
          .from("credentials")
          .select(view === "issued" ? credentialSelect : "id", {
            count: "exact",
            head: view !== "issued",
          })
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null, count: 0 }),
    orgIds.length
      ? db
          .from("qualification_requests")
          .select("*", { count: "exact", head: view !== "requests" })
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null, count: 0 }),
  ]);
  const credentials = credentialResult.data;
  const requests = requestResult.data;
  const eligible = organizations.filter(
    (o) => o.issuer_status === "authorized",
  );
  return (
    <div className="container page">
      <PageHeading
        eyebrow="PROOFPAK ORGANIZATIONS"
        title="Organization & credentials"
        description="Manage your organization, credentials and opportunities."
        action={
          <Link className="button secondary" href="/portal/company/profile">
            Organization profile
          </Link>
        }
      />
      <nav className="workspace-tabs" aria-label="Organization sections">
        {[
          ["overview", "Overview"],
          ["issue", "Issue credential"],
          ["issued", "Issued credentials"],
          ["requests", "Verification requests"],
          ["register", "Add organization"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/organizations?view=${key}`}
            aria-current={view === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {(error ||
        memberError ||
        credentialResult.error ||
        requestResult.error) && (
        <p className="notice">
          We could not load all organization records. Please try again. If it
          continues, ask support to check the connection, permissions, and
          database setup.
        </p>
      )}
      {view === "overview" && (
        <>
          <p className="workflow-callout">
            Register your organization → Request organization approval → Issue
            credentials when approved → Recipients accept and choose visibility.
            Challenges and paid work remain available through their own
            workspaces.
          </p>
          <div className="stats">
            <div className="stat">
              <span>Organizations</span>
              <strong>{organizations.length}</strong>
            </div>
            <div className="stat">
              <span>Approved organizations</span>
              <strong>{eligible.length}</strong>
            </div>
            <div className="stat">
              <span>Issued credentials</span>
              <strong>
                {credentialResult.error
                  ? "Unavailable"
                  : (credentialResult.count ?? 0)}
              </strong>
            </div>
            <div className="stat">
              <span>Verification requests</span>
              <strong>
                {requestResult.error
                  ? "Unavailable"
                  : (requestResult.count ?? 0)}
              </strong>
            </div>
          </div>
          <section className="section-spacer">
            <h2>Organization overview</h2>
            {organizations.length ? (
              organizations.map((o) => (
                <article className="panel section-spacer" key={o.id}>
                  <h3>{o.companies.name}</h3>
                  <p>{o.companies.description}</p>
                  <span className="tag">
                    {o.organization_type.replaceAll("_", " ")} · Organization{" "}
                    {o.issuer_status === "authorized"
                      ? "approved"
                      : o.issuer_status === "pending"
                        ? "awaiting approval"
                        : o.issuer_status}
                  </span>
                  <div className="button-row section-spacer">
                    {(members ?? []).some(
                      (m) =>
                        m.company_id === o.company_id && m.role === "owner",
                    ) && (
                      <Link
                        href={`/portal/company/profile?company=${o.company_id}`}
                      >
                        Edit organization profile
                      </Link>
                    )}
                    {o.issuer_status === "authorized" && (
                      <Link href="/organizations?view=issue">
                        Issue a credential
                      </Link>
                    )}
                    {o.issuer_status === "authorized" && (
                      <Link
                        href={`/wallet?purpose=credential_issuer&organization=${o.id}`}
                      >
                        Credential signing wallet
                      </Link>
                    )}
                  </div>
                  {o.issuer_status !== "authorized" && (
                    <p className="muted">
                      Contact the ProofPak administrator with your official
                      website and evidence that you represent this organization.
                      Registration does not establish trust.
                    </p>
                  )}
                </article>
              ))
            ) : (
              <Empty title="No organization yet">
                <Link href="/organizations?view=register">
                  Create an organization
                </Link>
                , or ask an existing organization owner to arrange membership
                with the administrator.
              </Empty>
            )}
          </section>
          <div className="activity-links">
            <Link href="/portal/company/create">
              <h2>Create a skill challenge</h2>
              <p>Unpaid practice work; multiple participants can submit.</p>
            </Link>
            <Link href="/paid-projects/new">
              <h2>Post a paid project</h2>
              <p>
                One selected worker, agreed milestones and devnet test-token
                payments.
              </p>
            </Link>
          </div>
        </>
      )}
      {view === "register" && (
        <details className="panel section-spacer" open>
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
                    {t.replaceAll("_", " ")}
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
      )}
      {view === "issue" && !eligible.length && (
        <Empty title="Organization approval is needed to issue credentials">
          Create your organization first, then contact the ProofPak
          administrator with your official website and evidence that you
          represent it.{" "}
          <Link href="/organizations?view=overview">
            Check organization status
          </Link>
          . You cannot approve your own organization.
        </Empty>
      )}
      {view === "issue" && eligible.length > 0 && (
        <section className="panel section-spacer">
          <h2>Issue a credential</h2>
          <p className="notice">
            Issuance creates a private record for recipient acceptance.
            Publishing and Solana anchoring are separate next steps.
          </p>
          <p className="muted">
            Use an existing recipient’s published passport URL or slug. No email
            search is available. Evidence stays private unless the recipient
            chooses to share it.
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
              label="Recipient passport slug or URL"
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
      {view === "issued" && (
        <section className="section-spacer">
          <h2>Issued credentials</h2>
          {(credentials ?? []).length ? (
            (credentials as unknown as Credential[]).map((c) => (
              <div key={c.id}>
                <CredentialRecord credential={c} />
                {c.credential_preferences.acceptance === "pending" && (
                  <p className="notice">
                    Waiting for the recipient to accept or decline. They choose
                    whether to publish it. A blockchain record can be added
                    after acceptance.
                  </p>
                )}
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
                    <ConfirmForm
                      action={revokeCredential}
                      title="Revoke this credential?"
                      message="This creates a permanent revocation event. The original claim and any historical transaction remain unchanged."
                      label="Confirm revocation"
                    >
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
                    </ConfirmForm>
                  </details>
                )}
              </div>
            ))
          ) : (
            <Empty title="No credentials issued yet">
              Once your organization is approved,{" "}
              <Link href="/organizations?view=issue">issue a credential</Link>.
              The recipient must accept it and choose whether to publish it.
            </Empty>
          )}
        </section>
      )}
      {view === "requests" && (
        <section className="section-spacer">
          <h2>Qualification verification requests</h2>
          <p className="muted">
            Review the original qualification through your institution’s
            records. ProofPak cannot check a university database automatically.
          </p>
          {!requests?.length && (
            <Empty title="No verification requests">
              Requests sent to your organization will appear here. Only approved
              institutions can confirm qualifications.
            </Empty>
          )}
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
      )}
    </div>
  );
}
