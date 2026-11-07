import test from "node:test";
import assert from "node:assert/strict";
import {
  rubricSchema,
  assessmentHash,
  assessmentJson,
  assessmentContextMatches,
  type AssessmentManifest,
  workCredentialTypes,
} from "../src/lib/challenge-assessment";
import { credentialClaim, credentialHash } from "../src/lib/credential-proof";
import { credentialIntegrity } from "../src/lib/credential-verification";
import type { Credential } from "../src/lib/credentials";
const manifest: AssessmentManifest = {
  schema: 1,
  challenge_id: "challenge",
  challenge_title: "Reviewed work",
  submission_id: "submission",
  review_id: "review",
  organization_id: "org",
  recipient_id: "recipient",
  reviewed_at: "2026-11-05",
  rubric_id: "rubric",
  criteria: [
    { title: "Accessibility", description: "Keyboard behavior is evaluated." },
  ],
  outcomes: ["met"],
  evidence_digest: "a".repeat(64),
};
test("rubric is optional, practical, bounded and rejects incomplete criteria", () => {
  assert.ok(rubricSchema.safeParse([]).success);
  assert.ok(
    !rubricSchema.safeParse([{ title: "ok", description: "short" }]).success,
  );
  assert.ok(
    !rubricSchema.safeParse(
      Array(7).fill({
        title: "Criterion",
        description: "A meaningful evaluation description.",
      }),
    ).success,
  );
  assert.ok(!workCredentialTypes.includes("degree" as never));
});
test("assessment encoding follows PostgreSQL canonical spacing and key order", async () => {
  assert.equal(
    assessmentJson({ longer: "value", a: [true, null, "text"] }),
    '{"a": [true, null, "text"], "longer": "value"}',
  );
  assert.equal(
    await assessmentHash(manifest),
    await assessmentHash(
      Object.fromEntries(
        Object.entries(manifest).reverse(),
      ) as AssessmentManifest,
    ),
  );
  assert.notEqual(
    await assessmentHash(manifest),
    await assessmentHash({ ...manifest, outcomes: ["needs_improvement"] }),
  );
});
test("existing v3 claim protects new source commitment without serializing private assessment data", async () => {
  const digest = await assessmentHash(manifest);
  const c = {
    id: "credential",
    organization_id: "org",
    authorization_id: "approval",
    recipient_id: "recipient",
    issuer_name: "Issuer",
    title: "Assessed recognition",
    credential_type: "company_achievement",
    description: "Explicit recognition for approved work.",
    issue_date: "2026-11-05",
    expiry_date: null,
    program_name: `Assessed work · sha256:${digest}`,
    award: "",
    evidence_digest: "a".repeat(64),
    created_at: "2026-11-05T00:00:00Z",
    credential_events: [],
    credential_preferences: {
      acceptance: "accepted",
      is_public: true,
      share_evidence: true,
    },
  } as Credential;
  const context = {
    challenge_id: "challenge",
    challenge_title: "Reviewed work",
    context_digest: digest,
    assessment: manifest,
  };
  c.credential_challenge_context = context;
  const claim = credentialClaim(c);
  assert.ok(!JSON.stringify(claim).includes("Keyboard behavior"));
  const hash = await credentialHash(claim);
  c.credential_proofs = [
    {
      signature: "offline-fixture",
      record_hash: hash,
      issuer_wallet: "offline-wallet",
      anchored_at: c.created_at,
    },
  ];
  assert.equal(
    (
      await credentialIntegrity(c, async () => ({
        valid: true,
        status: "finalized",
      }))
    ).state,
    "verified",
  );
  assert.equal(
    await assessmentContextMatches(c.program_name, {
      ...context,
      assessment: null,
    }),
    true,
  );
  c.credential_challenge_context = {
    ...context,
    assessment: { ...manifest, outcomes: ["needs_improvement"] },
  };
  let checked = false;
  assert.equal(
    (
      await credentialIntegrity(c, async () => {
        checked = true;
        return { valid: true };
      })
    ).state,
    "mismatch",
  );
  assert.equal(checked, false);
  assert.deepEqual(
    credentialClaim({ ...c, credential_challenge_context: null }),
    claim,
  );
});
