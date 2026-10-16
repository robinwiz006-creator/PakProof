import test from "node:test";
import assert from "node:assert/strict";
import { profileStepPatch, setupStep } from "../src/lib/profile-setup";
import {
  personalNavigation,
  secondaryNavigation,
  personalSection,
} from "../src/lib/dashboard-navigation";
import { portalDataNeeds } from "../src/lib/portal-data-needs";
test("partial profile saves whitelist their step and cannot alter identity, visibility, or issuer facts", () => {
  const about = {
    full_name: "Demo person",
    headline: "",
    university: "",
    location: "",
    bio: "",
    id: "another-user",
    is_public: true,
    issuer_status: "authorized",
    skills: "replacement",
  };
  assert.deepEqual(profileStepPatch("about", about), {
    full_name: "Demo person",
    headline: "",
    university: "",
    location: "",
    bio: "",
  });
  assert.deepEqual(
    profileStepPatch("skills", {
      skills: "Python, SQL, Python",
      is_public: true,
      full_name: "changed",
    }),
    { skills: ["Python", "SQL"] },
  );
  assert.deepEqual(
    profileStepPatch("publish", {
      slug: "demo-person",
      visibility: "public",
      bio: "changed",
      role: "admin",
    }),
    { slug: "demo-person", is_public: true },
  );
  assert.deepEqual(
    profileStepPatch("publish", { slug: "demo-person", visibility: "private" }),
    { slug: "demo-person", is_public: false },
  );
});
test("optional skills and biography can be skipped and publication requires an explicit valid choice", () => {
  assert.deepEqual(profileStepPatch("skills", { skills: "" }), { skills: [] });
  for (const values of [
    { slug: "demo-person" },
    { slug: "../other", visibility: "public" },
    { slug: "demo-person", visibility: "unknown" },
  ])
    assert.throws(() => profileStepPatch("publish", values));
  assert.throws(() => profileStepPatch("work", { id: "another-user" }));
  assert.equal(setupStep("untrusted"), "about");
});
test("five primary destinations keep wallet/payment secondary and group old routes without losing access", () => {
  assert.deepEqual(
    personalNavigation.map(([, label]) => label),
    ["Home", "My Profile", "Opportunities", "My Activity", "Credentials"],
  );
  assert.ok(secondaryNavigation.some(([path]) => path === "/wallet"));
  assert.ok(secondaryNavigation.some(([path]) => path === "/payments"));
  assert.equal(
    personalSection("/portal/talent/projects"),
    "/portal/talent/passport",
  );
  assert.equal(
    personalSection("/portal/talent/achievements"),
    "/portal/talent/activity",
  );
  assert.equal(portalDataNeeds("talent", "").achievements, false);
  assert.equal(portalDataNeeds("talent", "").submissions, false);
  assert.equal(portalDataNeeds("talent", "activity").submissions, true);
});

test("success and error redirects preserve setup step, organization section and literal feedback", async () => {
  const { messageLink } = await import("../src/lib/navigation-message");
  for (const path of [
    "/portal/talent/profile?step=skills",
    "/organizations?view=issued",
    "/organizations?view=register",
  ]) {
    const before = new URL(path, "https://example.com");
    const after = new URL(
      messageLink(path, "Saved & continue?"),
      "https://example.com",
    );
    for (const [key, value] of before.searchParams)
      assert.equal(after.searchParams.get(key), value);
    assert.equal(after.searchParams.get("message"), "Saved & continue?");
  }
  assert.throws(() => messageLink("https://unrelated.example", "Saved"));
  assert.throws(() => messageLink("//unrelated.example", "Saved"));
});
