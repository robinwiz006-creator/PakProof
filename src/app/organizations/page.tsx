import { OrganizationVerificationWorkspace } from "@/components/organization-verification-workspace";
import { CredentialCorrectionForm } from "@/components/credential-correction";
import Link from "next/link";
import { z } from "zod";
import { workCredentialTypes } from "@/lib/challenge-assessment";
import { IssuerTypeFields } from "@/components/issuer-type-fields";
import { credentialTypeLabels } from "@/lib/issuer-permissions";
import { ConfirmForm } from "@/components/confirm-form";
import { CredentialAnchor } from "@/components/credential-anchor";
import { PageHeading, Empty } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { CredentialRecord } from "@/components/credential-record";
import { credentialWorkspace } from "@/lib/credential-data";
import {
  organizationTypes,
  credentialSelect,
  credentialValidity,
  correctionStatus,
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
  searchParams: Promise<{
    message?: string;
    view?: string;
    submission?: string;
  }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message, view: requestedView, submission } = await searchParams;
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
  const [credentialResult, requestResult, auditResult, correctionAudit] =
    await Promise.all([
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
      view === "issued" && orgIds.length
        ? db
            .from("credential_issuance_audit")
            .select(
              "credential_id,representative_id,issued_at,authorization_id",
            )
            .in("organization_id", orgIds)
        : Promise.resolve({ data: [], error: null }),
      view === "issued" && orgIds.length
        ? db
            .from("credential_corrections")
            .select(
              "replacement_id,original_id,created_by,reason,state,created_at,responded_at",
            )
            .in("organization_id", orgIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (correctionAudit.error)
    throw new Error("Private correction history could not be loaded.");
  if (auditResult.error)
    throw new Error("Private issuance records could not be loaded.");
  const credentials = credentialResult.data;
  const requests = requestResult.data;
  let source: { id: string; company_id: string; title: string } | null = null;
  if (submission && z.uuid().safeParse(submission).success) {
    const { data, error } = await db
      .from("achievements")
      .select("submission_id,company_id,title")
      .eq("submission_id", submission)
      .maybeSingle();
    if (error) throw new Error("Approved work could not be loaded.");
    if (data)
      source = {
        id: data.submission_id,
        company_id: data.company_id,
        title: data.title,
      };
  }
  let sourceAssessment: {
    criteria: { title: string; description: string }[];
    outcomes: string[];
  } | null = null;
  if (source) {
    const { data, error } = await db
      .from("submission_reviews")
      .select("id,challenge_assessments(criteria,outcomes)")
      .eq("submission_id", source.id)
      .eq("decision", "approved")
      .maybeSingle();
    if (error) throw new Error("The approved assessment could not be loaded.");
    const value = data?.challenge_assessments;
    sourceAssessment = (Array.isArray(value) ? value[0] : value) ?? null;
  }
  const eligible = organizations.filter(
    (o) =>
      o.issuer_status === "authorized" &&
      (o.allowed_credential_types?.length ?? 0) > 0 &&
      (!submission ||
        Boolean(
          source &&
          source.company_id === o.company_id &&
          o.allowed_credential_types?.some((t) =>
            workCredentialTypes.includes(
              t as (typeof workCredentialTypes)[number],
            ),
          ),
        )),
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
      {view === "overview" &&
        organizations.map((o) => (
          <p className="notice section-spacer" key={`permissions-${o.id}`}>
            <strong>{o.companies.name}: </strong>Registered on ProofPak ·{" "}
            {o.issuer_status === "authorized"
              ? "Authorized for credential issuance"
              : o.issuer_status === "suspended"
                ? "Issuance suspended"
                : "Awaiting approval"}
            . Approved categories:{" "}
            {(o.allowed_credential_types ?? [])
              .map((t) => credentialTypeLabels[t] ?? t)
              .join(", ") || "None — administrator category review required"}
            . Approval does not establish government accreditation or guarantee
            a credential’s truth.
          </p>
        ))}
      {view === "overview" &&
        organizations.map((o) => (
          <OrganizationVerificationWorkspace
            key={`trust-${o.id}`}
            organization={o}
          />
        ))}
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
              <span>Ready to issue</span>
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
              value={
                source
                  ? `Recognition of approved work for ${source.title}. Issued following a separate organization decision.`
                  : undefined
              }
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
        <Empty title="Credential category approval is needed">
          Create your organization first, then contact the ProofPak
          administrator with your official website and evidence that you
          represent it.{" "}
          <Link href="/organizations?view=overview">
            Check organization status
          </Link>
          . An administrator must explicitly approve the credential categories
          you may issue. You cannot approve your own organization.
        </Empty>
      )}
      {view === "issue" && submission && !source && (
        <p className="notice">
          This approved work is unavailable. Return to challenge reviews and
          choose work your organization owns.
        </p>
      )}
      {view === "issue" && eligible.length > 0 && (
        <section className="panel section-spacer">
          <h2>Issue a credential</h2>
          <p className="notice">
            Issuance creates a private record for recipient acceptance.
            Publishing and Solana anchoring are separate next steps.
          </p>
          <p className="muted">
            {source
              ? "The recipient comes from the approved submission; a public passport is not required to receive this credential."
              : "Use an existing recipient’s published passport URL or slug. No email search is available."}{" "}
            Evidence stays private unless the recipient chooses to share it.
          </p>
          {source && (
            <p className="notice">
              Recognizing: {source.title}. Recipient and evidence come from the
              approved submission. Review the credential before issuing it;
              nothing is accepted or published automatically.
            </p>
          )}
          {source && (
            <details className="section-spacer">
              <summary>Review assessment before issuing</summary>
              {sourceAssessment?.criteria.length ? (
                <ul>
                  {sourceAssessment.criteria.map((c, i) => (
                    <li key={i}>
                      {c.title}:{" "}
                      {sourceAssessment!.outcomes[i]?.replaceAll("_", " ")}
                      <p className="muted">{c.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  This review has no structured rubric. No criterion outcomes
                  will be invented.
                </p>
              )}
            </details>
          )}
          <form action={issueCredential}>
            {source && (
              <input type="hidden" name="submission_id" value={source.id} />
            )}
            <IssuerTypeFields
              organizations={eligible.map((o) => ({
                id: o.id,
                name: o.companies.name,
                types: (o.allowed_credential_types ?? []).filter(
                  (t) =>
                    !source ||
                    workCredentialTypes.includes(
                      t as (typeof workCredentialTypes)[number],
                    ),
                ),
              }))}
            />
            {source ? (
              <>
                <input
                  type="hidden"
                  name="recipient_slug"
                  value="reviewed-recipient"
                />
                <p className="muted">
                  Recipient: the owner of the approved submission. A private
                  passport stays private.
                </p>
              </>
            ) : (
              <Field
                name="recipient_slug"
                label="Recipient passport slug or URL"
                required
              />
            )}
            <Field
              name="title"
              label="Credential title"
              value={
                source
                  ? `Recognition: ${source.title}`.slice(0, 160)
                  : undefined
              }
              required
              minLength={3}
              maxLength={160}
            />
            <Field
              name="description"
              label="Description"
              type="textarea"
              value={
                source
                  ? `Recognition of approved work for ${source.title}. Issued following a separate organization decision.`
                  : undefined
              }
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
            {source ? (
              <>
                <input name="program_name" type="hidden" value="" />
                <p className="muted">
                  The work-assessment integrity reference will be set
                  automatically.
                </p>
              </>
            ) : (
              <Field
                name="program_name"
                label="Course, program, or event (optional)"
                maxLength={200}
              />
            )}
            <Field
              name="award"
              label="Award or rank (optional)"
              maxLength={200}
            />
            {source ? (
              <>
                <input name="evidence_url" type="hidden" value="" />
                <p className="muted">
                  Approved work evidence stays private unless the recipient
                  chooses to share it.
                </p>
              </>
            ) : (
              <Field
                name="evidence_url"
                label="Supporting evidence URL (optional)"
                type="url"
              />
            )}
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
                <details className="section-spacer">
                  <summary>Private issuing representative</summary>
                  {auditResult.data
                    ?.filter((a) => a.credential_id === c.id)
                    .map((a) => (
                      <p className="muted hash" key={a.credential_id}>
                        Representative {a.representative_id} · Recorded{" "}
                        {a.issued_at} · Approval reference {a.authorization_id}
                      </p>
                    ))}
                  {!auditResult.data?.some((a) => a.credential_id === c.id) && (
                    <p className="muted">
                      Historical record: issuing representative was not
                      captured.
                    </p>
                  )}
                </details>
                {correctionAudit.data
                  ?.filter(
                    (a) => a.original_id === c.id || a.replacement_id === c.id,
                  )
                  .map((a) => (
                    <details className="section-spacer" key={a.replacement_id}>
                      <summary>Private correction audit · {a.state}</summary>
                      <p>{a.reason}</p>
                      <p className="muted hash">
                        Representative {a.created_by} · Recorded {a.created_at}
                        {a.responded_at ? ` · Decision ${a.responded_at}` : ""}
                      </p>
                      <Link
                        className="text-link"
                        href={`/credentials/${a.original_id}`}
                      >
                        Earlier record ↗
                      </Link>
                      {" · "}
                      <Link
                        className="text-link"
                        href={`/credentials/${a.replacement_id}`}
                      >
                        Replacement ↗
                      </Link>
                    </details>
                  ))}
                {c.credential_preferences.acceptance === "pending" &&
                  !c.credential_events.length &&
                  !correctionStatus(c)?.superseded && (
                    <p className="notice">
                      Waiting for the recipient to accept or decline. They
                      choose whether to publish it. A blockchain record can be
                      added after acceptance.
                    </p>
                  )}
                {c.credential_preferences.acceptance === "accepted" &&
                  !c.credential_proofs?.length &&
                  credentialValidity(c) === "Current" &&
                  organizations.some(
                    (o) =>
                      o.id === c.organization_id &&
                      o.issuer_status === "authorized",
                  ) && <CredentialAnchor achievementId={c.id} />}
                {organizations.some(
                  (o) =>
                    o.id === c.organization_id &&
                    o.issuer_status === "authorized" &&
                    o.allowed_credential_types?.includes(c.credential_type),
                ) && <CredentialCorrectionForm credential={c} />}
                {!c.credential_events.length && (
                  <details className="panel">
                    <summary>Revoke this credential</summary>
                    <p className="muted">
                      Revocation preserves the historical record. To correct
                      facts, use the separate corrected replacement action. No
                      consent is copied.
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
                        label="Public explanation for revocation or correction"
                        hint="This explanation may appear on the published credential. Do not include staff details or private investigation notes."
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
