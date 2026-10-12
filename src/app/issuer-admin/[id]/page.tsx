import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { credentialWorkspace } from "@/lib/credential-data";
import { PageHeading } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { ConfirmForm } from "@/components/confirm-form";
import { authorizeIssuer } from "@/lib/credential-actions";
export default async function IssuerReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, user } = await credentialWorkspace();
  const { data: admin, error } = await db.rpc("is_platform_administrator");
  if (error || !admin) notFound();
  const [org, members, reviews] = await Promise.all([
    db
      .from("organizations")
      .select("*,companies(name,description,website)")
      .eq("id", id)
      .maybeSingle(),
    db.from("company_memberships").select("company_id").eq("user_id", user.id),
    db
      .from("issuer_authorizations")
      .select("id,review_note,created_at,administrator_id")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (org.error || members.error || reviews.error)
    throw new Error("Organization review could not be loaded.");
  const o = org.data;
  if (!o) notFound();
  const own = (members.data ?? []).some((m) => m.company_id === o.company_id);
  return (
    <div className="container page">
      <Link className="text-link" href="/issuer-admin">
        ← Review queue
      </Link>
      <PageHeading
        eyebrow="PRIVATE IDENTITY REVIEW"
        title={o.companies.name}
        description={`${o.organization_type} · ${o.issuer_status}`}
      />
      <div className="workflow-columns">
        <section className="panel">
          <h2>Organization information</h2>
          <p>{o.companies.description}</p>
          {o.companies.website && (
            <a
              className="text-link"
              href={o.companies.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official website ↗
            </a>
          )}
          <p className="muted section-spacer">
            Registered {o.created_at.slice(0, 10)} · ID{" "}
            <span className="hash">{o.id}</span>
          </p>
          <p className="notice section-spacer">
            Verify official identity and the representative’s authority outside
            ProofPak. A website alone is not enough. Private decision notes are
            for administrators only.
          </p>
        </section>
        <section className="panel">
          <h2>Record a decision</h2>
          {own ? (
            <p className="notice">
              You belong to this organization. A different administrator must
              review it. Self-authorization is blocked in the database.
            </p>
          ) : (
            <ConfirmForm
              action={authorizeIssuer}
              title="Confirm issuer status change"
              message="This changes credential issuance permissions. Confirm that you checked identity, representative authority, and supporting evidence."
              label="Record decision"
            >
              <input type="hidden" name="organization_id" value={o.id} />
              <input
                type="hidden"
                name="reviewed_name"
                value={o.companies.name}
              />
              <input
                type="hidden"
                name="reviewed_description"
                value={o.companies.description}
              />
              <input
                type="hidden"
                name="reviewed_website"
                value={o.companies.website}
              />
              <Field
                label="Private decision note and evidence checked"
                name="note"
                type="textarea"
                required
                minLength={20}
                maxLength={2000}
              />
              <label className="field">
                Decision
                <select name="decision" required defaultValue="">
                  <option value="">Choose decision</option>
                  <option value="authorize">Approve credential issuance</option>
                  <option value="suspend">
                    Suspend / deny credential issuance
                  </option>
                </select>
              </label>
              <SubmitButton>Review and confirm decision</SubmitButton>
            </ConfirmForm>
          )}
        </section>
      </div>
      <section className="section-spacer">
        <h2>Private authorization history</h2>
        <p className="muted">
          Latest 50 decisions. Historical authorization records remain
          unchanged.
        </p>
        {!(reviews.data ?? []).length && (
          <p className="notice">No authorization decisions recorded yet.</p>
        )}
        <ol className="audit-timeline">
          {(reviews.data ?? []).map((r) => (
            <li key={r.id}>
              <time>{r.created_at}</time>
              <p>{r.review_note}</p>
              <small className="hash">
                Administrator {r.administrator_id} · Reference {r.id}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
