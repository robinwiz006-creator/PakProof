import test from "node:test";
import assert from "node:assert/strict";
import { credentialSelect, credentialValidity } from "../src/lib/credentials";

test("shared credential query uses the fixed public lifecycle projection rather than raw staff audit", () => {
  assert.ok(
    credentialSelect.includes(
      "credential_events:public_credential_events(event_type,reason,created_at)",
    ),
  );
  assert.ok(!credentialSelect.includes("credential_events(*)"));
  assert.ok(!credentialSelect.includes("actor_id"));
});
test("projected revocation history remains authoritative for validity even after expiry", () => {
  assert.equal(
    credentialValidity({
      expiry_date: "2020-01-01",
      credential_events: [
        {
          event_type: "revoked",
          reason: "Public explanation",
          created_at: "2026-11-06T00:00:00Z",
        },
      ],
    }),
    "Revoked",
  );
});
