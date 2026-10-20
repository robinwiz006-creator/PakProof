"use client";
import Link from "next/link";
import { useState } from "react";
import { tokenAmount } from "@/lib/payments";
import {
  filterOpportunities,
  opportunityDate,
  type OpportunityItem,
  type OpportunityKind,
} from "@/lib/opportunity-discovery";
import { Tags } from "./ui";
export function OpportunityBrowser({
  items,
  configured = true,
  challengesUnavailable = false,
  projectsUnavailable = false,
}: {
  items: OpportunityItem[];
  configured?: boolean;
  challengesUnavailable?: boolean;
  projectsUnavailable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<OpportunityKind>("all");
  const rows = filterOpportunities(items, query, kind);
  const unavailable =
    !configured ||
    ((kind === "all" || kind === "challenge") && challengesUnavailable) ||
    ((kind === "all" || kind === "project") && projectsUnavailable);
  return (
    <div className="opportunity-discovery">
      <div className="discovery-toolbar">
        <label className="field">
          Search opportunities
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, organization or skill"
          />
        </label>
        <div
          className="discovery-types"
          role="group"
          aria-label="Opportunity type"
        >
          {(
            [
              ["all", "All"],
              ["challenge", "Challenges"],
              ["project", "Paid Projects"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={kind === value ? "selected" : ""}
              aria-pressed={kind === value}
              key={value}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="opportunity-disclosure">
        Paid projects use Solana devnet test USDC with no monetary value.
        Payment is not guaranteed. Challenges listed here are unpaid.
      </p>
      {!configured ? (
        <p className="notice" role="status">
          Opportunities aren’t available right now. Please try again later.
        </p>
      ) : (
        <>
          {challengesUnavailable && kind !== "project" && (
            <p className="notice" role="status">
              Challenges could not be loaded. Please try again later.
            </p>
          )}
          {projectsUnavailable && kind !== "challenge" && (
            <p className="notice" role="status">
              Paid projects could not be loaded. Please try again later.
            </p>
          )}
        </>
      )}
      <p className="discovery-count muted" role="status">
        {rows.length} {rows.length === 1 ? "opportunity" : "opportunities"}{" "}
        shown
        {unavailable && rows.length ? " · some listings are unavailable" : ""}
      </p>
      <div className="discovery-grid">
        {rows.map((item) => (
          <article className="discovery-card" key={`${item.kind}-${item.id}`}>
            <div className="discovery-card-type">
              <span className="tag">
                {item.kind === "project"
                  ? "Paid project · devnet"
                  : "Unpaid challenge"}
              </span>
              <span>{item.organization}</span>
            </div>
            <h2>
              <Link
                href={
                  item.kind === "project"
                    ? `/paid-projects/${item.id}`
                    : `/challenges/${item.id}`
                }
              >
                {item.title}
              </Link>
            </h2>
            {item.description && <p className="muted">{item.description}</p>}
            <Tags values={item.skills.slice(0, 4)} />
            <div className="discovery-card-footer">
              <span>Due {opportunityDate(item.deadline)}</span>
              {item.kind === "project" && item.budgetUnits !== undefined && (
                <strong>{tokenAmount(item.budgetUnits)} test USDC</strong>
              )}
            </div>
            <Link
              className="text-link"
              href={
                item.kind === "project"
                  ? `/paid-projects/${item.id}`
                  : `/challenges/${item.id}`
              }
            >
              {item.kind === "project" ? "View project →" : "View challenge →"}
            </Link>
          </article>
        ))}
      </div>
      {!rows.length && !unavailable && (
        <div className="discovery-empty">
          <h2>
            {query.trim() || kind !== "all"
              ? "No matching opportunities"
              : "No open opportunities yet"}
          </h2>
          <p className="muted">
            {items.length
              ? "Try another search or clear your filters."
              : "Check back soon, or keep building your Skill Passport."}
          </p>
          {query.trim() || kind !== "all" ? (
            <button
              className="button secondary"
              onClick={() => {
                setQuery("");
                setKind("all");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link className="button secondary" href="/portal/talent/profile">
              Build my profile
            </Link>
          )}
        </div>
      )}
      {configured && (
        <p className="muted discovery-limit">
          Search covers up to 100 newest open listings of each type.
        </p>
      )}
    </div>
  );
}
