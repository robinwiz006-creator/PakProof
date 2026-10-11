"use client";
import { useState } from "react";
import type { Challenge } from "@/lib/types";
import { ChallengeCard, Empty } from "./ui";
export function ChallengeBrowser({ items }: { items: Challenge[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const filtered = items.filter(
    (c) =>
      `${c.title} ${c.companies?.name} ${c.skills.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!difficulty || c.difficulty === difficulty),
  );
  return (
    <>
      <div className="filters">
        <input
          aria-label="Search challenges by title, company, or skill"
          placeholder="Search a skill, challenge, or company…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">All difficulties</option>
          {["Beginner", "Intermediate", "Advanced"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <p className="muted demo-label" aria-live="polite">
        {filtered.length} challenges
      </p>
      <div className="challenge-grid">
        {filtered.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </div>
      {!filtered.length && (
        <Empty title="No challenges found">
          Try a different skill or come back after a company publishes a brief.
        </Empty>
      )}
    </>
  );
}
