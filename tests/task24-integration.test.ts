import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnPath } from "../src/lib/passport";
import {
  authHref,
  signedInDestination,
  confirmationCallbackUrl,
  opportunityAuthMessage,
} from "../src/lib/auth-navigation";
import {
  personalSection,
  secondaryNavigation,
} from "../src/lib/dashboard-navigation";
test("history preserves its exact safe destination through authentication", () => {
  const path = "/profile-history";
  assert.equal(safeReturnPath(path), path);
  assert.equal(signedInDestination({}, path), path);
  assert.ok(authHref("/sign-in", path).includes("next=%2Fprofile-history"));
  assert.equal(
    new URL(
      confirmationCallbackUrl("https://example.test", path),
    ).searchParams.get("next"),
    path,
  );
  assert.match(opportunityAuthMessage(path) ?? "", /education and work/);
  for (const invalid of [
    "/profile-history/evil",
    "/profile-history?redirect=https://evil.test",
    "//evil.test/profile-history",
  ])
    assert.equal(safeReturnPath(invalid), null);
});
test("history and invitation pages connect to existing profile and credentials sections", () => {
  assert.equal(personalSection("/profile-history"), "/portal/talent/passport");
  assert.equal(personalSection("/credential-invitations"), "/my-credentials");
  assert.equal(
    personalSection("/credential-invitations/" + "a".repeat(64)),
    "/my-credentials",
  );
  assert.ok(
    secondaryNavigation.some(([path]) => path === "/credential-invitations"),
  );
});
