import type { ReactNode } from "react";
import { Tags } from "./ui";
import { tokenAmount, type PaidProject } from "@/lib/payments";
import { opportunityDate, shortText } from "@/lib/opportunity-discovery";
export function PaidProjectBrief({
  project: p,
  action,
}: {
  project: Pick<
    PaidProject,
    | "title"
    | "description"
    | "requirements"
    | "skills"
    | "deadline"
    | "budget_units"
    | "status"
    | "companies"
  >;
  action?: ReactNode;
}) {
  const description = shortText(p.description, 220);
  return (
    <>
      <header className="paid-project-intro">
        <div>
          <p className="eyebrow">
            {p.companies?.name ?? "Organization"} · Paid project
          </p>
          <h1>{p.title}</h1>
          <p className="muted project-short-description">{description}</p>
        </div>
        {action && <div className="project-primary-action">{action}</div>}
      </header>
      <dl className="project-key-facts">
        <div>
          <dt>Total budget</dt>
          <dd>
            {tokenAmount(p.budget_units)} <span>test USDC</span>
          </dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{opportunityDate(p.deadline)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{p.status.replaceAll("_", " ")}</dd>
        </div>
      </dl>
      <p className="notice project-devnet-note">
        Solana devnet test USDC has no monetary value. Funds are not locked;
        payment is not guaranteed.
      </p>
      <section className="project-scope section-spacer">
        <h2>Scope &amp; deliverables</h2>
        <p className="project-requirements">{p.requirements}</p>
        {p.description.replace(/\s+/g, " ").trim().length > 220 && (
          <details className="section-spacer">
            <summary>Full project description</summary>
            <p className="project-requirements">{p.description}</p>
          </details>
        )}
      </section>
      {!!p.skills.length && (
        <section className="project-skills section-spacer">
          <h2>Skills required</h2>
          <Tags values={p.skills} />
        </section>
      )}
    </>
  );
}

export function ProjectMilestoneHeading({
  milestone: m,
}: {
  milestone: {
    position: number;
    title: string;
    deliverables: string;
    amount_units: string;
    deadline: string;
  };
}) {
  return (
    <>
      <div className="milestone-heading">
        <div>
          <p className="eyebrow">Milestone {m.position}</p>
          <h3>{m.title}</h3>
        </div>
        <strong>{tokenAmount(m.amount_units)} test USDC</strong>
      </div>
      <p className="project-requirements">{m.deliverables}</p>
      <p className="muted">Due {opportunityDate(m.deadline)}</p>
    </>
  );
}
