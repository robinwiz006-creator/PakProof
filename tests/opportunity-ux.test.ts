import test from "node:test";
import assert from "node:assert/strict";
import {
  filterOpportunities,
  opportunityItems,
  shortText,
} from "../src/lib/opportunity-discovery";
import { projectApplicationState } from "../src/lib/project-application";
const challenges = [
  {
    id: "c",
    title: "Analyse sales",
    description: "Use SQL to explain a public dataset.",
    skills: ["SQL"],
    deadline: "2099-01-01",
    companies: { name: "Data organization" },
  },
];
const projects = [
  {
    id: "p",
    title: "Accessible dashboard",
    description: "Build a clear interface.",
    skills: ["React"],
    deadline: "2099-02-01",
    companies: { name: "Design organization" },
    budget_units: "125000001",
    worker_id: "PRIVATE",
    current_offer_id: "PRIVATE",
    payout_authorization_id: "PRIVATE",
  },
];
test("discovery searches public title, organization, summary and skills with distinct types", () => {
  const items = opportunityItems(challenges, projects);
  assert.equal(filterOpportunities(items, "DATA sql", "all")[0].id, "c");
  assert.equal(
    filterOpportunities(items, "accessible React", "project")[0].id,
    "p",
  );
  assert.equal(filterOpportunities(items, "React", "challenge").length, 0);
  assert.equal(filterOpportunities(items, "", "all").length, 2);
  assert.equal(filterOpportunities(items, "nothing", "all").length, 0);
  assert.equal(items[1].budgetUnits, "125000001");
  assert.ok(!JSON.stringify(items).includes("PRIVATE"));
  assert.equal("budgetUnits" in items[0], false);
  assert.equal(shortText(" A\n short   description "), "A short description");
  assert.equal(shortText("x".repeat(200)).length, 181);
});
test("application UI mirrors open project/date checks without granting authorization", () => {
  const open = {
    signedIn: true,
    companyMember: false,
    hasApplication: false,
    status: "published",
    deadline: "2099-01-01",
  };
  assert.equal(projectApplicationState(open, "2099-01-01"), "apply");
  assert.equal(
    projectApplicationState({ ...open, signedIn: false }, "2099-01-01"),
    "sign-in",
  );
  assert.equal(
    projectApplicationState({ ...open, companyMember: true }, "2099-01-01"),
    "manage",
  );
  assert.equal(
    projectApplicationState({ ...open, hasApplication: true }, "2099-01-01"),
    "applied",
  );
  assert.equal(projectApplicationState(open, "2099-01-02"), "closed");
  for (const status of ["draft", "offered", "active", "completed", "cancelled"])
    assert.equal(
      projectApplicationState({ ...open, status }, "2099-01-01"),
      "closed",
    );
});
