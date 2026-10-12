import test from "node:test";
import assert from "node:assert/strict";
import { credentialInput, credentialValidity } from "../src/lib/credentials";
const input = {
  organization_id: "40000000-0000-4000-8000-000000000001",
  recipient_slug: "ayesha-khan",
  title: "Hackathon Winner",
  credential_type: "hackathon_achievement",
  description: "Recognition for completing the documented hackathon work.",
  issue_date: "2026-10-12",
  expiry_date: "",
  program_name: "Hackathon",
  award: "First place",
  evidence_url: "https://example.com/results",
};
test("credential form rejects unsupported claims and unsafe evidence", () => {
  assert.ok(credentialInput.safeParse(input).success);
  assert.ok(
    !credentialInput.safeParse({
      ...input,
      credential_type: "automatic_university_verification",
    }).success,
  );
  assert.ok(
    !credentialInput.safeParse({
      ...input,
      evidence_url: "javascript:alert(1)",
    }).success,
  );
  assert.ok(
    !credentialInput.safeParse({ ...input, expiry_date: "2026-10-11" }).success,
  );
});
test("revocation and expiry are independent of blockchain status", () => {
  assert.equal(
    credentialValidity(
      { issue_date: "2026-10-13", expiry_date: null, credential_events: [] },
      "2026-10-12",
    ),
    "Not yet valid",
  );
  assert.equal(
    credentialValidity(
      { expiry_date: null, credential_events: [] },
      "2026-10-12",
    ),
    "Current",
  );
  assert.equal(
    credentialValidity(
      { expiry_date: "2026-10-11", credential_events: [] },
      "2026-10-12",
    ),
    "Expired",
  );
  assert.equal(
    credentialValidity(
      { expiry_date: "2026-10-12", credential_events: [] },
      "2026-10-12",
    ),
    "Current",
  );
  assert.equal(
    credentialValidity(
      {
        expiry_date: null,
        credential_events: [
          {
            event_type: "revoked",
            reason: "Correction",
            created_at: "2026-10-12",
          },
        ],
      },
      "2026-10-12",
    ),
    "Revoked",
  );
});
