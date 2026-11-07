import test from "node:test";
import assert from "node:assert/strict";
import {
  permittedCredentialTypes,
  issuanceTrustLabel,
} from "../src/lib/issuer-permissions";
import { credentialClaim, credentialHash } from "../src/lib/credential-proof";
import type { Credential } from "../src/lib/credentials";
const historical: Credential = {
  id: "fixture",
  organization_id: "org",
  recipient_id: "recipient",
  authorization_id: "approval",
  issuer_name: "Fixture",
  title: "Fixture course",
  credential_type: "course",
  description: "A synthetic record used only for testing.",
  issue_date: "2026-01-01",
  expiry_date: null,
  program_name: "",
  award: "",
  evidence_digest: "a".repeat(64),
  created_at: "2026-01-01T00:00:00Z",
  credential_events: [],
  credential_preferences: {
    acceptance: "accepted",
    is_public: true,
    share_evidence: false,
  },
};
test("permissions default empty and never derive academic authority from registration", () => {
  assert.deepEqual(permittedCredentialTypes(), []);
  assert.deepEqual(
    permittedCredentialTypes(["course", "workshop", "unknown", "course"]),
    ["course", "workshop"],
  );
  assert.ok(
    !permittedCredentialTypes(["course", "workshop"]).includes("degree"),
  );
});
test("historical category and representative coverage is not invented", () => {
  assert.match(issuanceTrustLabel(historical), /category review not recorded/);
  assert.match(
    issuanceTrustLabel({
      ...historical,
      credential_issuance_provenance: [
        {
          authorization_id: "approval",
          authorized_credential_type: "course",
          issued_at: historical.created_at,
          representative_recorded: true,
        },
      ],
    }),
    /Category approved at issuance/,
  );
});
test("new accountability metadata does not change v3 claims or historical hashes", async () => {
  const enriched = {
    ...historical,
    credential_issuance_provenance: [
      {
        authorization_id: "approval",
        authorized_credential_type: "course",
        issued_at: historical.created_at,
        representative_recorded: true,
      },
    ],
  };
  assert.deepEqual(credentialClaim(historical), credentialClaim(enriched));
  assert.equal(
    await credentialHash(credentialClaim(historical)),
    await credentialHash(credentialClaim(enriched)),
  );
  assert.ok(
    !JSON.stringify(credentialClaim(enriched)).includes("representative"),
  );
});
