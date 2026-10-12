import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { credentialWorkspace } from "@/lib/credential-data";
import { authorizeIssuer } from "@/lib/credential-actions";
import type { Organization } from "@/lib/credentials";
export const dynamic = "force-dynamic";
export default async function IssuerAdmin({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db } = await credentialWorkspace();
  const { data: admin, error } = await db.rpc("is_platform_administrator");
  if (error || !admin) notFound();
  const { message } = await searchParams;
  const { data } = await db
    .from("organizations")
    .select("*,companies(name,description,website)");
  const { data: reviews } = await db
    .from("issuer_authorizations")
    .select("*")
    .order("created_at", { ascending: false });
  return (
    <div className="container page">
      <PageHeading
        eyebrow="RESTRICTED ADMINISTRATION"
        title="Issuer authorization"
        description="Review the legal identity and the representative’s authority outside ProofPak before granting issuance. A website alone is not enough."
      />
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {((data as unknown as Organization[]) ?? []).map((o) => (
        <article className="panel section-spacer" key={o.id}>
          <h2>{o.companies.name}</h2>
          <p>{o.companies.description}</p>
          <p>
            {o.organization_type} · {o.issuer_status}
          </p>
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
          <form action={authorizeIssuer}>
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
              name="note"
              label="Identity review, representative authority, and evidence checked"
              type="textarea"
              required
              minLength={20}
              maxLength={2000}
            />
            <div className="field">
              <label htmlFor={`decision-${o.id}`}>Decision</label>
              <select id={`decision-${o.id}`} name="decision">
                <option value="suspend">Suspend / deny issuance</option>
                <option value="authorize">Authorize credential issuance</option>
              </select>
            </div>
            <SubmitButton>Record authorization decision</SubmitButton>
          </form>
        </article>
      ))}
      <h2 className="section-spacer">Private authorization audit</h2>
      {(reviews ?? []).map((r) => (
        <article className="panel section-spacer" key={r.id}>
          <p>
            Organization {r.organization_id} · Review {r.id}
          </p>
          <p>{r.review_note}</p>
          <p className="muted">
            {r.created_at} · Administrator {r.administrator_id}
          </p>
        </article>
      ))}
    </div>
  );
}
