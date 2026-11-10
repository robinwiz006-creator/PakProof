import test from "node:test";
import assert from "node:assert/strict";
import { loadSection } from "../src/lib/section-result";
import { organizationSetup } from "../src/lib/organization-onboarding";
import type { Organization } from "../src/lib/credentials";
const org = {
  issuer_status: "pending",
  allowed_credential_types: [],
  trust_level: "self_registered",
} as unknown as Organization;
test("section failures, no records, and successful records remain distinct", async () => {
  assert.equal(
    (await loadSection(async () => ({ data: [], error: null }))).state,
    "empty",
  );
  assert.equal(
    (
      await loadSection(async () => ({
        data: null,
        error: { message: "PRIVATE" },
      }))
    ).state,
    "unavailable",
  );
  assert.equal(
    (
      await loadSection(() => {
        throw new Error("PRIVATE");
      })
    ).state,
    "unavailable",
  );
  assert.equal(
    (await loadSection(async () => ({ data: null, error: null }))).state,
    "unavailable",
  );
  assert.deepEqual(
    (
      await loadSection(async () => ({
        data: [{ title: "public" }],
        error: null,
      }))
    ).items,
    [{ title: "public" }],
  );
});
test("independent section reads start concurrently and keep successful siblings", async () => {
  let started = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const jobs = [
    loadSection(async () => {
      started++;
      await gate;
      return { data: [1], error: null };
    }),
    loadSection(async () => {
      started++;
      await gate;
      throw new Error("private error");
    }),
  ];
  assert.equal(started, 2);
  release();
  const results = await Promise.all(jobs);
  assert.equal(results[0].state, "loaded");
  assert.equal(results[1].state, "unavailable");
  assert.ok(!JSON.stringify(results).includes("private error"));
});
test("institutional identity does not grant category permission", () => {
  const identity = organizationSetup({
    ...org,
    trust_level: "verified_organization",
  });
  assert.equal(identity.verified, true);
  assert.equal(identity.canIssue, false);
  const categories = organizationSetup({
    ...org,
    issuer_status: "authorized",
    allowed_credential_types: ["course"],
  });
  assert.equal(categories.verified, false);
  assert.equal(categories.canIssue, true);
});
test("suspension, missing categories, and unknown legacy trust never imply approval", () => {
  assert.equal(
    organizationSetup({
      ...org,
      issuer_status: "suspended",
      allowed_credential_types: ["degree"],
    }).canIssue,
    false,
  );
  assert.equal(
    organizationSetup({ ...org, issuer_status: "authorized" }).canIssue,
    false,
  );
  assert.equal(
    organizationSetup({
      ...org,
      trust_level: "trusted_assessment_partner",
      trust_suspended: true,
    }).verified,
    false,
  );
  assert.equal(
    organizationSetup({ ...org, trust_level: undefined }).trustLabel,
    "Verification status unavailable",
  );
});
