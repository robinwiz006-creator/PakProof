import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isConfigured, supabase } from "@/lib/supabase/server";
import { PageHeading, Tags } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { projectData, milestoneData } from "@/lib/paid-data";
import { tokenAmount, type PaidOffer } from "@/lib/payments";
import {
  publishPaidProject,
  applyPaidProject,
  selectPaidWorker,
  respondPaidOffer,
  submitPaidMilestone,
  reviewPaidMilestone,
} from "@/lib/paid-actions";
export const dynamic = "force-dynamic";
export default async function PaidProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !isConfigured()) notFound();
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data, error } = await db
    .from("paid_projects")
    .select("*,companies(name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const p = projectData(data);
  const { message } = await searchParams;
  const { data: milestones } = await db
    .from("paid_milestones")
    .select("*")
    .eq("project_id", id)
    .order("position");
  const ms = (milestones ?? []).map(milestoneData);
  const { data: member } = user
    ? await db
        .from("company_memberships")
        .select("role")
        .eq("company_id", p.company_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const isCompany = Boolean(member),
    isWorker = user?.id === p.worker_id;
  const { data: apps } = user
    ? await db
        .from("paid_project_applications")
        .select("*")
        .eq("project_id", id)
        .order("created_at")
    : { data: [] };
  const ownApp = (apps ?? []).find((a) => a.worker_id === user?.id);
  const { data: offers } = user
    ? await db
        .from("paid_project_offers")
        .select("*")
        .eq("project_id", id)
        .order("version", { ascending: false })
    : { data: [] };
  const offer = ((offers as unknown as PaidOffer[]) ?? []).find(
    (o) => o.id === p.current_offer_id,
  );
  const { data: submissions } = user
    ? await db
        .from("paid_milestone_submissions")
        .select("*")
        .in(
          "milestone_id",
          ms.map((m) => m.id),
        )
        .order("created_at")
    : { data: [] };
  const { data: reviews } = user
    ? await db
        .from("paid_milestone_reviews")
        .select("*")
        .in(
          "milestone_id",
          ms.map((m) => m.id),
        )
        .order("created_at")
    : { data: [] };
  return (
    <div className="container page">
      <PageHeading
        eyebrow={`${p.companies?.name ?? "Company"} · ${p.status}`}
        title={p.title}
        description={p.description}
      />
      <div className="button-row">
        <Link className="text-link" href="/paid-projects">
          Paid projects
        </Link>
        <Link className="text-link" href="/wallet">
          Wallet ownership
        </Link>
        <Link className="text-link" href="/portal/talent/passport">
          My passport
        </Link>
      </div>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      <section className="panel section-spacer">
        <h2>Scope and requirements</h2>
        <p>{p.requirements}</p>
        <Tags values={p.skills} />
        <p className="section-spacer">
          Deadline {p.deadline} · Budget {tokenAmount(p.budget_units)} devnet
          test USDC
        </p>
        <p className="muted">
          Test tokens have no promised monetary value. Direct payment follows
          approval. Funds are not locked or guaranteed. Submitted evidence and
          payment records stay private to the parties.
        </p>
      </section>
      {isCompany && p.status === "draft" && (
        <form className="panel section-spacer" action={publishPaidProject}>
          <h2>Review before publishing</h2>
          <p>
            Check the scope, budget and milestones below. Published terms cannot
            be silently edited.
          </p>
          <input name="project_id" type="hidden" value={id} />
          <SubmitButton>Publish project</SubmitButton>
        </form>
      )}
      {user && !isCompany && p.status === "published" && !ownApp && (
        <section className="panel section-spacer">
          <h2>Apply for this project</h2>
          <form action={applyPaidProject}>
            <input name="project_id" type="hidden" value={id} />
            <Field
              name="pitch"
              label="Explain your relevant work and approach"
              type="textarea"
              required
              minLength={20}
              maxLength={4000}
            />
            <Field
              name="evidence_url"
              label="Project or evidence URL"
              type="url"
              required
            />
            <SubmitButton>Send application</SubmitButton>
          </form>
        </section>
      )}
      {!user && p.status === "published" && (
        <Link className="button section-spacer" href="/sign-in">
          Sign in to apply
        </Link>
      )}
      {ownApp && (
        <p className="notice section-spacer">
          Your application: {ownApp.status}.{" "}
          {ownApp.status === "selected" && p.status === "offered"
            ? "Review the offer below before accepting."
            : "Track work and decisions on this page."}
        </p>
      )}
      {isCompany && (
        <section className="section-spacer">
          <h2>Applications</h2>
          {!(apps ?? []).length && (
            <p className="muted">No applications yet.</p>
          )}
          {(apps ?? []).map((a) => (
            <article className="panel section-spacer" key={a.id}>
              <h3>{a.applicant_name}</h3>
              <p>{a.pitch}</p>
              <a
                className="text-link"
                href={a.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Application evidence ↗
              </a>
              <p>{a.status}</p>
              {p.status === "published" && a.status === "applied" && (
                <form action={selectPaidWorker}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <SubmitButton>
                    Select worker and send fixed terms
                  </SubmitButton>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {offer && (isWorker || isCompany) && (
        <section className="panel section-spacer">
          <h2>Agreed terms · version {offer.version}</h2>
          <p>
            Company: {offer.terms.company_name} · {offer.response}
          </p>
          <p>{offer.terms.description}</p>
          <p>{offer.terms.requirements}</p>
          <p>
            Total: {tokenAmount(offer.terms.budget_units)} test USDC · Due{" "}
            {offer.terms.deadline}
          </p>
          {offer.terms.milestones.map((m) => (
            <p key={m.id}>
              {m.title}: {m.deliverables} · {tokenAmount(m.amount_units)} test
              USDC · {m.deadline}
            </p>
          ))}
          <p className="muted">
            These exact terms are fixed. This MVP does not support amendments:
            do not start different work without a separately agreed project. No
            payment is guaranteed and approval does not mean payment has
            completed.
          </p>
          {isWorker && offer.response === "pending" && (
            <form action={respondPaidOffer}>
              <input type="hidden" name="offer_id" value={offer.id} />
              <input type="hidden" name="project_id" value={id} />
              <label className="field">
                Decision
                <select name="decision">
                  <option value="decline">Decline this offer</option>
                  <option value="accept">Accept these exact terms</option>
                </select>
              </label>
              <SubmitButton>Confirm decision</SubmitButton>
            </form>
          )}
        </section>
      )}
      <section className="section-spacer">
        <h2>Milestones</h2>
        {ms.map((m) => {
          const submission = (submissions ?? []).find(
            (s) => s.id === m.current_submission_id,
          );
          return (
            <article className="panel section-spacer" key={m.id}>
              <p className="eyebrow">Milestone {m.position}</p>
              <h3>{m.title}</h3>
              <p>{m.deliverables}</p>
              <p className="muted">
                {tokenAmount(m.amount_units)} test USDC · Due {m.deadline}
              </p>
              {(isCompany || isWorker) && (
                <>
                  <span className="tag">
                    Work: {m.work_status.replaceAll("_", " ")}
                  </span>
                  {submission && (
                    <div className="section-spacer">
                      <h4>Submitted work</h4>
                      <p>{submission.explanation}</p>
                      <a
                        className="text-link"
                        href={submission.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Private submitted evidence ↗
                      </a>
                    </div>
                  )}
                  {(reviews ?? [])
                    .filter((r) => r.milestone_id === m.id)
                    .map((r) => (
                      <p className="notice section-spacer" key={r.id}>
                        {r.decision}: {r.feedback}
                      </p>
                    ))}
                  {isWorker &&
                    p.status === "active" &&
                    ["not_submitted", "revisions"].includes(m.work_status) && (
                      <form
                        className="section-spacer"
                        action={submitPaidMilestone}
                      >
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <Field
                          name="explanation"
                          label="Work completed and explanation"
                          type="textarea"
                          required
                          minLength={20}
                          maxLength={5000}
                        />
                        <Field
                          name="evidence_url"
                          label="Work evidence URL"
                          type="url"
                          required
                        />
                        <SubmitButton>
                          {m.work_status === "revisions"
                            ? "Submit revised work"
                            : "Submit milestone work"}
                        </SubmitButton>
                      </form>
                    )}
                  {isCompany && m.work_status === "submitted" && (
                    <form
                      className="section-spacer"
                      action={reviewPaidMilestone}
                    >
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="milestone_id" value={m.id} />
                      <Field
                        name="feedback"
                        label="Review feedback"
                        type="textarea"
                        required
                        minLength={10}
                        maxLength={2000}
                      />
                      <label className="field">
                        Decision
                        <select name="decision">
                          <option value="revisions">Request revisions</option>
                          <option value="approved">
                            Approve work (payment still due)
                          </option>
                        </select>
                      </label>
                      <SubmitButton>Save review</SubmitButton>
                    </form>
                  )}
                  {m.work_status === "approved" && (
                    <p className="notice section-spacer">
                      Work approved · payment due. Approval does not mark the
                      milestone paid.
                    </p>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
