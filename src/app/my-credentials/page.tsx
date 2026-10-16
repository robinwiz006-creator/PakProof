import Link from "next/link";
import { PageHeading, Empty } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { CredentialRecord } from "@/components/credential-record";
import { credentialWorkspace } from "@/lib/credential-data";
import {
  credentialSelect,
  type Credential,
  type Organization,
} from "@/lib/credentials";
import {
  respondCredential,
  requestQualification,
} from "@/lib/credential-actions";
export const dynamic = "force-dynamic";
export default async function MyCredentials({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message } = await searchParams;
  const [credentialResult, orgResult, requestResult] = await Promise.all([
    db
      .from("credentials")
      .select(credentialSelect)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("organizations")
      .select("*,companies(name)")
      .eq("organization_type", "university")
      .eq("issuer_status", "authorized"),
    db
      .from("qualification_requests")
      .select("*")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const { data, error } = credentialResult;
  const orgs = orgResult.data;
  const requests = requestResult.data;
  return (
    <div className="container page">
      <PageHeading
        eyebrow="MY PASSPORT"
        title="Credentials"
        description="Review credentials sent to you. Accept or decline each one, then choose whether to display it on your Skill Passport."
      />
      <div className="button-row">
        <Link className="text-link" href="/portal/talent/passport">
          My Profile
        </Link>
        <Link className="text-link" href="/organizations">
          Organization workspace
        </Link>
      </div>
      <p className="workflow-callout">
        Review the issuer and record → Accept or decline → Choose whether to
        publish. Acceptance alone does not make a credential public or
        blockchain verified.
      </p>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {error ? (
        <p className="notice section-spacer">
          Credentials are not available until the new migration is applied. Your
          existing passport is unchanged.
        </p>
      ) : !(data ?? []).length ? (
        <Empty title="No credentials yet">
          You can build and publish your profile before receiving any
          credentials. An approved organization can send you one using your
          public profile link.{" "}
          <Link href="/portal/talent/profile?step=publish">
            Manage your profile link
          </Link>
          .
        </Empty>
      ) : (
        (data as unknown as Credential[]).map((c) => (
          <div key={c.id}>
            <CredentialRecord credential={c} />
            <form className="panel" action={respondCredential}>
              <input name="credential_id" type="hidden" value={c.id} />
              <div className="field">
                <label htmlFor={`accept-${c.id}`}>Your decision</label>
                <select
                  id={`accept-${c.id}`}
                  name="acceptance"
                  required
                  defaultValue={
                    c.credential_preferences.acceptance === "pending"
                      ? ""
                      : c.credential_preferences.acceptance
                  }
                >
                  <option value="">Choose accept or decline</option>
                  <option value="declined">Decline / keep off passport</option>
                  <option value="accepted">Accept credential</option>
                </select>
              </div>
              <label>
                <input
                  type="checkbox"
                  name="is_public"
                  defaultChecked={c.credential_preferences.is_public}
                />{" "}
                Display on my published passport
              </label>
              <br />
              <label>
                <input
                  type="checkbox"
                  name="share_evidence"
                  defaultChecked={c.credential_preferences.share_evidence}
                />{" "}
                Also publish supporting evidence
              </label>
              <p className="muted">
                A private passport keeps this credential private. Evidence URLs
                may have their own access settings: check those before sharing.
              </p>
              <SubmitButton>Save my decision and visibility</SubmitButton>
            </form>
          </div>
        ))
      )}
      <section className="section-spacer">
        <h2>Qualification verification</h2>
        <p className="muted">
          An uploaded or linked degree is unverified until an authorized
          institution representative confirms it. Requests and their evidence
          are private to you and the institution.
        </p>
        {(requests ?? []).map((r) => (
          <article className="panel section-spacer" key={r.id}>
            <h3>{r.title}</h3>
            <span className="tag">
              {r.status === "approved"
                ? "Institution confirmed · credential available above"
                : r.status === "rejected"
                  ? "Unverified · request rejected"
                  : "Unverified · awaiting institution review"}
            </span>
            <p>{r.feedback}</p>
          </article>
        ))}
        {(orgs ?? []).length > 0 ? (
          <details className="panel section-spacer">
            <summary>Request degree verification</summary>
            <form action={requestQualification}>
              <div className="field">
                <label htmlFor="university">Authorized university</label>
                <select id="university" name="organization_id">
                  {(orgs as unknown as Organization[]).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.companies.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                name="title"
                label="Qualification title"
                required
                minLength={3}
                maxLength={160}
              />
              <Field
                name="description"
                label="Qualification details"
                type="textarea"
                required
                minLength={20}
                maxLength={4000}
              />
              <Field
                name="issue_date"
                label="Qualification issue date"
                type="date"
                required
              />
              <Field
                name="evidence_url"
                label="Private evidence URL"
                type="url"
                required
                hint="Use a document link accessible only to the institution. Do not use a public link for sensitive documents."
              />
              <SubmitButton>Request institution review</SubmitButton>
            </form>
          </details>
        ) : (
          <p className="notice">
            No authorized university is available for requests yet. Do not send
            private documents to an unverified organization.
          </p>
        )}
      </section>
    </div>
  );
}
