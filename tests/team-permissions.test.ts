import { test } from "node:test";
import assert from "node:assert/strict";
import {
  teamCan,
  assignableRoles,
  teamInviteStatus,
} from "../src/lib/team-permissions";
import { safeReturnPath } from "../src/lib/passport";
import { authHref, confirmationCallbackUrl } from "../src/lib/auth-navigation";
test("team roles are scoped and legacy members are not promoted", () => {
  assert.equal(teamCan("reviewer", "team"), false);
  assert.equal(teamCan("credential_manager", "credentials"), true);
  assert.equal(teamCan("credential_manager", "opportunities"), false);
  assert.equal(teamCan("opportunity_manager", "credentials"), false);
  assert.equal(teamCan("submission_reviewer", "review"), true);
  assert.equal(teamCan("submission_reviewer", "discovery"), false);
  assert.equal(teamCan(undefined, "team"), false);
  assert.equal(teamCan("administrator", "team"), true);
});
test("administrators cannot assign administrators or owners", () => {
  assert.ok(!assignableRoles("administrator").includes("administrator"));
  assert.equal(assignableRoles("credential_manager").length, 0);
  assert.ok(!assignableRoles("owner").some((r) => String(r) === "owner"));
});
test("secure team routes survive signup and confirmation without open redirects", () => {
  const path = "/team-invitations/" + "a".repeat(64);
  assert.equal(safeReturnPath(path), path);
  assert.equal(
    new URL(
      confirmationCallbackUrl("https://example.test", path),
    ).searchParams.get("next"),
    path,
  );
  assert.ok(authHref("/sign-up", path).includes(encodeURIComponent(path)));
  for (const p of [
    "/team-invitations/guess",
    "//evil.test/team-invitations",
    "/team-invitations?email=private@example.test",
  ])
    assert.equal(safeReturnPath(p), null);
});
test("only pending invitations expire; terminal history is retained", () => {
  assert.equal(
    teamInviteStatus({ status: "pending", expires_at: "2000-01-01" }),
    "expired",
  );
  assert.equal(
    teamInviteStatus({ status: "accepted", expires_at: "2000-01-01" }),
    "accepted",
  );
});
