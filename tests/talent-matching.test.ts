import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evidenceDirectoryInput,
  matchingExplanation,
  directoryPageHref,
} from "../src/lib/employer-discovery";
import { contactStatus } from "../src/lib/contact-handoff";
test("combined evidence filters are bounded and preserve pagination", () => {
  const filters = {
    q: "developer",
    skill: "Solana, React",
    education: "computing",
    experience: "frontend",
    category: "course",
    project: "interface",
    sort: "relevance",
    completed: "1",
    opportunity: "challenge:25000000-0000-4000-8000-000000000001",
  };
  assert.equal(evidenceDirectoryInput.parse(filters).sort, "relevance");
  const url = new URL(
    directoryPageHref("fixture", filters, 2),
    "https://example.test",
  );
  for (const key of [
    "skill",
    "education",
    "experience",
    "category",
    "project",
    "sort",
    "completed",
    "opportunity",
  ])
    assert.equal(
      url.searchParams.get(key),
      filters[key as keyof typeof filters],
    );
  for (const invalid of [
    { sort: "best_people" },
    { category: "invented" },
    { skill: Array(11).fill("React").join(",") },
    { education: "x".repeat(121) },
    { opportunity: "https://evil.test" },
  ])
    assert.equal(evidenceDirectoryInput.safeParse(invalid).success, false);
});
test("match explanations use only supplied public counts and never invent an AI score", () => {
  assert.equal(matchingExplanation({}), "");
  const text = matchingExplanation({
    matched_skills: 2,
    matching_projects: 1,
    assessed_matches: 1,
    current_credentials: 0,
  });
  assert.match(text, /Matches 2 requested skills/);
  assert.match(text, /1 public assessed achievement/);
  assert.ok(!text.includes("credential"));
  assert.ok(!text.includes("score"));
});
test("expired opportunity contact has a clear terminal label", () => {
  assert.equal(contactStatus("expired"), "Invitation expired");
});
