import { test } from "node:test";
import assert from "node:assert/strict";
import { invitationInput, invitationStatus } from "../src/lib/invitations";
import { safeReturnPath } from "../src/lib/passport";
import {
  authHref,
  confirmationCallbackUrl,
  opportunityAuthMessage,
} from "../src/lib/auth-navigation";
const value = {
  organization_id: "23000000-0000-4000-8000-000000000001",
  recipient_email: " User@Example.com ",
  title: "Course completion",
  credential_type: "course",
  description: "Completed a practical course with reviewed work.",
  issue_date: "2026-11-01",
  expiry_date: "",
  program_name: "",
  award: "",
  evidence_url: "",
};
test("invitation input reuses credential rules and normalizes email", () => {
  assert.equal(
    invitationInput.parse(value).recipient_email,
    "user@example.com",
  );
  for (const patch of [
    { recipient_email: "bad" },
    { credential_type: "unknown" },
    { description: "tiny" },
    { expiry_date: "2020-01-01" },
  ])
    assert.equal(
      invitationInput.safeParse({ ...value, ...patch }).success,
      false,
    );
});
test("invitation state derives expiry without rewriting accepted history", () => {
  assert.equal(
    invitationStatus({ status: "pending", expires_at: "2000-01-01" }),
    "expired",
  );
  assert.equal(
    invitationStatus({ status: "accepted", expires_at: "2000-01-01" }),
    "accepted",
  );
});
test("invitation context survives auth and confirmation without arbitrary redirects", () => {
  const path = "/credential-invitations/" + "a".repeat(64);
  assert.equal(safeReturnPath(path), path);
  assert.ok(authHref("/sign-up", path).includes(encodeURIComponent(path)));
  assert.ok(
    confirmationCallbackUrl("https://example.com", path).includes(
      encodeURIComponent(path),
    ),
  );
  assert.match(opportunityAuthMessage(path) ?? "", /invited email/);
  for (const bad of [
    "https://evil.example/credential-invitations",
    "//evil.example",
    "/credential-invitations/abc",
    "/credential-invitations?email=user@example.com",
  ])
    assert.equal(safeReturnPath(bad), null);
});
