import { test } from "node:test";
import assert from "node:assert/strict";
import { historySchema } from "../src/lib/profile-history";
const value = {
  kind: "education",
  organization: "University",
  title: "Degree",
  field: "Computing",
  start_date: "2020-09-01",
  end_date: "2024-06-01",
  ongoing: false,
  description: "Study",
  is_public: false,
};
test("education and employment validate without verification claims", () => {
  assert.ok(historySchema.safeParse(value).success);
  assert.ok(historySchema.safeParse({ ...value, kind: "employment" }).success);
});
test("ongoing requires empty end date", () => {
  assert.ok(
    historySchema.safeParse({ ...value, ongoing: true, end_date: "" }).success,
  );
  assert.equal(
    historySchema.safeParse({ ...value, ongoing: true }).success,
    false,
  );
});
test("invalid chronology, dates and empty inputs fail", () => {
  for (const patch of [
    { end_date: "2019-01-01" },
    { start_date: "2024-02-30" },
    { organization: " " },
    { title: "" },
    { description: "x".repeat(2001) },
    { kind: "verified" },
  ])
    assert.equal(
      historySchema.safeParse({ ...value, ...patch }).success,
      false,
    );
});
test("untrusted owner and verification fields are stripped", () => {
  const parsed = historySchema.parse({
    ...value,
    owner_id: "attacker",
    verified: true,
  });
  assert.equal("owner_id" in parsed, false);
  assert.equal("verified" in parsed, false);
});
