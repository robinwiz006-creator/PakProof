import test from "node:test";
import assert from "node:assert/strict";
import {
  directoryInput,
  directoryPageHref,
  opportunityReference,
} from "../src/lib/employer-discovery";
import { profileStepPatch } from "../src/lib/profile-setup";
test("directory search validates bounded input and server-page parameters", () => {
  assert.deepEqual(directoryInput.parse({}), { q: "", skill: "", page: 1 });
  for (const v of [
    { page: 0 },
    { page: 10001 },
    { q: "x".repeat(121) },
    { skill: "x".repeat(81) },
    { page: "1 or true" },
  ])
    assert.ok(!directoryInput.safeParse(v).success);
  assert.equal(directoryInput.parse({ page: "2", q: " SQL " }).q, "SQL");
});
test("pagination links preserve company and filters without offsite navigation", () => {
  const href = directoryPageHref(
    "fixture",
    { q: "a&b", skill: "React", credentials: "1", assessed: "1", saved: "1" },
    2,
  );
  const u = new URL(href, "https://example.com");
  assert.equal(u.origin, "https://example.com");
  assert.equal(u.searchParams.get("q"), "a&b");
  assert.equal(u.searchParams.get("company"), "fixture");
  assert.equal(u.searchParams.get("saved"), "1");
  assert.equal(u.searchParams.get("page"), "2");
});
test("contact references accept only supported existing-opportunity identifiers", () => {
  const id = "81000000-0000-4000-8000-000000000004";
  assert.deepEqual(opportunityReference(""), {
    challenge: null,
    project: null,
  });
  assert.deepEqual(opportunityReference(`challenge:${id}`), {
    challenge: id,
    project: null,
  });
  assert.deepEqual(opportunityReference(`project:${id}`), {
    challenge: null,
    project: id,
  });
  for (const v of [
    "https://evil.test",
    "javascript:alert(1)",
    "challenge:not-a-uuid",
    `user:${id}`,
  ])
    assert.throws(() => opportunityReference(v));
});
test("ordinary profile publication does not grant directory or contact consent", () => {
  assert.deepEqual(
    profileStepPatch("publish", {
      slug: "public-passport",
      visibility: "public",
      is_discoverable: true,
      allow_contact_requests: true,
    }),
    { slug: "public-passport", is_public: true },
  );
});
