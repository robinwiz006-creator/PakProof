import test from "node:test";
import assert from "node:assert/strict";
import {
  credentialLifecycle,
  verificationCheckedAt,
} from "../src/lib/credential-lifecycle";
import {
  credentialVisibleAssessment,
  canShareCredential,
} from "../src/lib/credential-presentation";
import { credentialIntegrity } from "../src/lib/credential-verification";
import { credentialClaim, credentialHash } from "../src/lib/credential-proof";
import type { Credential } from "../src/lib/credentials";
const c: Credential = {
  id: "fixture",
  organization_id: "org",
  authorization_id: "approval",
  recipient_id: "recipient",
  issuer_name: "Fixture organization",
  title: "Original qualification",
  credential_type: "course",
  description: "An offline immutable claim, not a real award.",
  created_at: "2025-01-01T00:00:00Z",
  issue_date: "2025-01-01",
  expiry_date: null,
  program_name: "",
  award: "",
  evidence_digest: "a".repeat(64),
  credential_events: [],
  credential_preferences: {
    acceptance: "accepted",
    is_public: true,
    share_evidence: false,
  },
};
const status = {
  credential_id: "fixture",
  is_replacement: false,
  replaces_id: null,
  superseded: true,
  pending_replacement_id: null,
  replacement_id: null,
  incoming_state: null,
};
test("active requires acceptance, valid recorded dates and no revocation/supersession", () => {
  assert.equal(credentialLifecycle(c, "2026-11-07").status, "Active");
  for (const acceptance of ["pending", "declined"] as const) {
    const x = {
      ...c,
      credential_preferences: { ...c.credential_preferences, acceptance },
    };
    assert.equal(credentialLifecycle(x).active, false);
    assert.equal(
      credentialLifecycle(x).status,
      acceptance === "pending" ? "Awaiting acceptance" : "Declined",
    );
  }
  assert.equal(
    credentialLifecycle({ ...c, expiry_date: "2026-11-07" }, "2026-11-07")
      .active,
    true,
  );
  assert.equal(
    credentialLifecycle({ ...c, expiry_date: "2026-11-06" }, "2026-11-07")
      .status,
    "Expired",
  );
  assert.equal(
    credentialLifecycle({ ...c, issue_date: "2026-11-08" }, "2026-11-07")
      .status,
    "Not yet valid",
  );
  assert.equal(
    credentialLifecycle({ ...c, credential_correction_status: status }).status,
    "Superseded",
  );
  assert.equal(
    credentialLifecycle({
      ...c,
      credential_correction_status: status,
      credential_events: [
        {
          event_type: "revoked",
          reason: "Revoked explicitly",
          created_at: "2026-01-01",
        },
      ],
    }).status,
    "Revoked",
  );
});
test("sharing, institutional trust, category suspension and credential validity remain independent", () => {
  const x = {
    ...c,
    organizations: {
      id: "org",
      company_id: "company",
      organization_type: "training",
      issuer_status: "suspended" as const,
      authorization_id: "approval",
      companies: {
        name: "Fixture",
        description: "Synthetic issuer",
        website: "",
      },
      trust_level: "self_registered",
      trust_suspended: true,
    },
  };
  assert.equal(credentialLifecycle(x).status, "Active");
  assert.equal(
    credentialLifecycle({
      ...c,
      credential_preferences: { ...c.credential_preferences, is_public: false },
    }).status,
    "Active",
  );
  assert.equal(
    canShareCredential(x, {
      full_name: "Recipient",
      slug: "recipient",
      is_public: false,
    }),
    false,
  );
});
test("a matching finalized historical proof remains verifiable after revocation or supersession", async () => {
  const hash = await credentialHash(credentialClaim(c));
  for (const record of [
    {
      ...c,
      credential_events: [
        {
          event_type: "revoked",
          reason: "Revoked explicitly",
          created_at: "2026-01-01",
        },
      ],
    },
    { ...c, credential_correction_status: status },
    {
      ...c,
      issue_date: "2019-01-01",
      created_at: "2019-01-01T00:00:00Z",
      expiry_date: "2020-01-01",
    },
  ]) {
    const recordHash = await credentialHash(credentialClaim(record));
    const checked = await credentialIntegrity(
      {
        ...record,
        credential_proofs: [
          {
            signature: "offline-reference",
            issuer_wallet: "offline-wallet",
            record_hash: recordHash,
            anchored_at: "2025-01-02",
          },
        ],
      },
      async () => ({ valid: true, status: "finalized" }),
    );
    assert.equal(checked.state, "verified");
    assert.equal(credentialLifecycle(record).active, false);
    if (record.expiry_date === c.expiry_date) assert.equal(recordHash, hash);
    assert.equal(checked.hash, recordHash);
  }
});
test("assessment rendering fails closed without publication/evidence consent even if supplied a private snapshot", () => {
  const context = {
    challenge_id: "c",
    challenge_title: "Original",
    context_digest: "a".repeat(64),
    assessment: {
      schema: 1,
      challenge_id: "c",
      challenge_title: "Original",
      submission_id: "s",
      review_id: "r",
      organization_id: "o",
      recipient_id: "p",
      reviewed_at: "2025-01-01",
      rubric_id: null,
      criteria: [],
      outcomes: [],
      evidence_digest: "b".repeat(64),
    },
  };
  const record = { ...c, credential_challenge_context: context };
  assert.equal(
    credentialVisibleAssessment(record, true, false)?.assessment,
    null,
  );
  assert.equal(
    credentialVisibleAssessment(record, false, false)?.assessment,
    null,
  );
  assert.deepEqual(
    credentialVisibleAssessment(record, false, true)?.assessment,
    context.assessment,
  );
  assert.deepEqual(
    credentialVisibleAssessment(
      {
        ...record,
        credential_preferences: {
          ...c.credential_preferences,
          share_evidence: true,
        },
      },
      true,
      false,
    )?.assessment,
    context.assessment,
  );
});
test("check timestamps are explicit UTC values and never fabricate missing checks", () => {
  assert.equal(verificationCheckedAt(), null);
  assert.equal(verificationCheckedAt("invalid"), null);
  assert.match(verificationCheckedAt("2026-11-07T10:00:00Z")!, /10:00:00 UTC$/);
});
