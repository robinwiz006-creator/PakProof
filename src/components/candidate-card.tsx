import Link from "next/link";
import { Tags } from "./ui";
import { Field, SubmitButton } from "./forms";
import type { CandidateCardData } from "@/lib/employer-discovery";
export function CandidateCard({
  candidate: c,
  companyId,
  opportunities = [],
  save,
  remove,
  contact,
}: {
  candidate: CandidateCardData;
  companyId: string;
  opportunities?: { value: string; title: string }[];
  save: (form: FormData) => Promise<void>;
  remove: (form: FormData) => Promise<void>;
  contact: (form: FormData) => Promise<void>;
}) {
  const ids = (
    <>
      <input name="company_id" type="hidden" value={companyId} />
      <input name="candidate_id" type="hidden" value={c.id} />
    </>
  );
  return (
    <article className="panel section-spacer">
      <header className="list-row">
        <div>
          <h2>
            <Link href={`/talent/${c.slug}`}>{c.full_name}</Link>
          </h2>
          {c.headline && <p className="muted">{c.headline}</p>}
        </div>
        {c.saved && <span className="tag">Saved privately</span>}
      </header>
      <p className="record-label section-spacer">
        Skills added by the individual
      </p>
      <Tags values={c.skills.slice(0, 8)} />
      {c.projects.length > 0 && (
        <section className="section-spacer">
          <h3>Public projects</h3>
          {c.projects.map((p) => (
            <div key={p.id}>
              <strong>{p.title}</strong>
              <p className="muted">{p.description}</p>
            </div>
          ))}
        </section>
      )}
      {c.credentials.length > 0 && (
        <section className="section-spacer">
          <h3>Published organization-issued credentials</h3>
          {c.credentials.map((r) => (
            <p key={r.id}>
              <Link className="text-link" href={`/credentials/${r.id}`}>
                {r.title}
              </Link>{" "}
              · {r.issuer_name} · {r.validity}
            </p>
          ))}
        </section>
      )}
      {c.achievements.length > 0 && (
        <section className="section-spacer">
          <h3>Company-approved achievements</h3>
          {c.achievements.map((a) => (
            <p key={a.id}>
              {a.title} ·{" "}
              {a.assessed
                ? "Assessed-work summary shared by the owner"
                : "Company approval; not an independently issued qualification"}
            </p>
          ))}
        </section>
      )}
      <div className="button-row section-spacer">
        <Link className="button secondary" href={`/talent/${c.slug}`}>
          View Passport ↗
        </Link>
      </div>
      <details className="section-spacer">
        <summary>
          {c.saved ? "Private shortlist note" : "Save to shortlist"}
        </summary>
        <form action={save}>
          {ids}
          <Field
            name="note"
            label="Internal note (organization members only)"
            type="textarea"
            maxLength={500}
            value={c.internal_note ?? ""}
            hint="Keep it short. Do not paste private evidence or contact information."
          />
          <SubmitButton>
            {c.saved ? "Update note" : "Save candidate"}
          </SubmitButton>
        </form>
        {c.saved && (
          <form className="section-spacer" action={remove}>
            {ids}
            <SubmitButton>Remove from shortlist</SubmitButton>
          </form>
        )}
      </details>
      {c.allow_contact_requests ? (
        <details className="section-spacer">
          <summary>Request contact</summary>
          <form action={contact}>
            {ids}
            <Field
              name="purpose"
              label="Purpose or opportunity"
              type="textarea"
              required
              minLength={20}
              maxLength={1000}
            />
            <label className="field">
              Link to your open opportunity (optional)
              <select name="opportunity">
                <option value="">No opportunity linked</option>
                {opportunities.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              One request per company and person. Limits apply. This is an
              in-app invitation, not email or a job offer.
            </p>
            <SubmitButton>Send contact request</SubmitButton>
          </form>
        </details>
      ) : (
        <p className="muted section-spacer">
          This person is not accepting contact requests.
        </p>
      )}
    </article>
  );
}
