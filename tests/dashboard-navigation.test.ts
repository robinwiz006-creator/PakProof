import test from "node:test";
import assert from "node:assert/strict";
import { portalDataNeeds } from "../src/lib/portal-data-needs";
import { recipientPassportSlug } from "../src/lib/credentials";

test("settings and profile do not load unrelated portfolio or submission data", () => {
  for (const section of ["settings", "profile", "browse"]) {
    assert.deepEqual(portalDataNeeds("talent", section), {
      projects: false,
      achievements: false,
      submissions: false,
    });
  }
  assert.deepEqual(portalDataNeeds("talent", "achievements"), {
    projects: true,
    achievements: true,
    submissions: false,
  });
  assert.deepEqual(portalDataNeeds("talent", "projects"), {
    projects: true,
    achievements: false,
    submissions: false,
  });
  assert.deepEqual(portalDataNeeds("talent", "submissions"), {
    projects: false,
    achievements: false,
    submissions: true,
  });
  assert.deepEqual(portalDataNeeds("company", "reviews"), {
    projects: false,
    achievements: false,
    submissions: false,
  });
});

test("recipient lookup accepts copied passport URLs and normalizes slugs", () => {
  for (const value of [
    " ayesha-khan ",
    "AYESHA-KHAN",
    "/talent/ayesha-khan/",
    "https://pak-proof.vercel.app/talent/ayesha-khan?ref=share#about",
  ]) {
    assert.equal(recipientPassportSlug.parse(value), "ayesha-khan");
  }
  for (const value of [
    "",
    "https://example.com/",
    "https://example.com/organizations",
    "ayesha@example.com",
    "../private",
    "javascript:alert(1)",
  ]) {
    assert.equal(recipientPassportSlug.safeParse(value).success, false);
  }
});
