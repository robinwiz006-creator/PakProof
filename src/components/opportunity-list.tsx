import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { tokenAmount } from "@/lib/payments";
import type {
  LiveChallenge,
  LivePaidProject,
  OpportunityResult,
} from "@/lib/live-opportunities";
function Opportunity({
  item,
  paid,
  budget,
}: {
  item: LiveChallenge;
  paid?: boolean;
  budget?: string | number;
}) {
  return (
    <Link
      className="opportunity-row"
      href={paid ? `/paid-projects/${item.id}` : `/challenges/${item.id}`}
    >
      <div>
        <span className="opportunity-type">
          {paid ? "Paid project · devnet" : "Unpaid challenge"}
        </span>
        <h4>{item.title}</h4>
        <p>{item.companies?.name ?? "Organization"}</p>
        <div className="opportunity-skills">
          {item.skills.slice(0, 3).map((skill) => (
            <span key={skill}>{skill}</span>
          ))}
        </div>
      </div>
      <div className="opportunity-facts">
        <span>Due {item.deadline}</span>
        {paid && budget !== undefined && (
          <strong>{tokenAmount(String(budget))} test USDC</strong>
        )}
        <ArrowUpRight size={20} aria-hidden="true" />
      </div>
    </Link>
  );
}
export function OpportunityList({
  configured,
  challenges,
  projects,
}: {
  configured: boolean;
  challenges: OpportunityResult<LiveChallenge>;
  projects: OpportunityResult<LivePaidProject>;
}) {
  return (
    <div className="opportunities-live" data-testid="live-opportunities">
      {!configured && (
        <p className="opportunity-notice">
          Live listings are not connected in this preview. No example
          opportunities are shown.
        </p>
      )}
      <div className="opportunity-columns">
        <section aria-label="Live skill challenges">
          <h3>
            Skill challenges <span>01</span>
          </h3>
          {challenges.unavailable ? (
            <p className="opportunity-notice" role="status">
              Challenges could not be loaded. Please try again later.
            </p>
          ) : challenges.items.length ? (
            challenges.items.map((item) => (
              <Opportunity key={item.id} item={item} />
            ))
          ) : (
            <p className="opportunity-empty">
              No open challenges right now. Published briefs will appear here.
            </p>
          )}
        </section>
        <section aria-label="Live paid projects">
          <h3>
            Paid projects <span>02</span>
          </h3>
          {projects.unavailable ? (
            <p className="opportunity-notice" role="status">
              Paid projects could not be loaded. Please try again later.
            </p>
          ) : projects.items.length ? (
            projects.items.map((item) => (
              <Opportunity
                key={item.id}
                item={item}
                paid
                budget={item.budget_units}
              />
            ))
          ) : (
            <p className="opportunity-empty">
              No open paid projects right now. Check back as organizations
              publish work.
            </p>
          )}
        </section>
      </div>
      <p className="opportunity-disclosure">
        Challenges listed here are unpaid. Paid projects use Solana devnet test
        tokens, not real money. Payment is not guaranteed.
      </p>
    </div>
  );
}
