"use client";
import Link from "next/link";
import { useState } from "react";
import { tokenAmount } from "@/lib/payments";
import type { ProjectListing } from "@/lib/opportunity-presentation";
import { Tags, Empty } from "./ui";
export function PaidProjectBrowser({ items }: { items: ProjectListing[] }) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("");
  const rows = items.filter(
    (p) =>
      `${p.title} ${p.companies?.name ?? ""} ${p.skills.join(" ")}`
        .toLowerCase()
        .includes(q.trim().toLowerCase()) &&
      (!status || p.status === status),
  );
  return (
    <>
      <div className="filters">
        <input
          aria-label="Search paid projects by title, organization, or skill"
          placeholder="Search work, organization, or skill…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Project status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All project statuses</option>
          {Array.from(new Set(items.map((p) => p.status)))
            .sort()
            .map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
        </select>
      </div>
      <p className="muted" role="status">
        {rows.length} matching projects · devnet test tokens only
      </p>
      <div className="project-ledger">
        {rows.map((p) => (
          <Link
            className="project-ledger-row"
            href={`/paid-projects/${p.id}`}
            key={p.id}
          >
            <div>
              <p className="eyebrow">
                {p.companies?.name ?? "Organization"} · Paid project
              </p>
              <h2>{p.title}</h2>
              <p className="muted">{p.description.slice(0, 180)}</p>
              <Tags values={p.skills} />
            </div>
            <div className="project-ledger-meta">
              <span className={`tag status-${p.status}`}>
                {p.status.replaceAll("_", " ")}
              </span>
              <strong>{tokenAmount(p.budget_units)} test USDC</strong>
              <span>Due {p.deadline}</span>
              <span className="text-link">Scope & milestones →</span>
            </div>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <Empty title="No matching paid projects">
          Try another skill or clear your filters. No payment is guaranteed.
        </Empty>
      )}
    </>
  );
}
