import test from "node:test";
import assert from "node:assert/strict";
import type { Credential } from "../src/lib/credentials";
import {
  canShareCredential,
  credentialEvidenceUrl,
  integrityLabel,
  credentialDate,
  safeCredentialWebsite,
} from "../src/lib/credential-presentation";
import { credentialIntegrity } from "../src/lib/credential-verification";
import {
  credentialClaim,
  credentialHash,
  credentialEvidenceDigest,
} from "../src/lib/credential-proof";
function sample(): Credential {
  return {
    id: "credential-fixture",
    recipient_id: "recipient-fixture",
    organization_id: "issuer-fixture",
    authorization_id: "approval-fixture",
    issuer_name: "Illustrative organization",
    title: "Illustrative qualification",
    credential_type: "course",
    description: "Offline fixture; not a real credential.",
    issue_date: "2025-01-01",
    expiry_date: null,
    created_at: "2025-01-01T00:00:00Z",
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
}
const recipient = {
  full_name: "Illustrative recipient",
  slug: "illustrative",
  is_public: true,
};
test("sharing needs acceptance, credential publication and public passport independently", () => {
  const c = sample();
  assert.equal(canShareCredential(c, recipient), true);
  for (const acceptance of ["pending", "declined"] as const)
    assert.equal(
      canShareCredential(
        {
          ...c,
          credential_preferences: { ...c.credential_preferences, acceptance },
        },
        recipient,
      ),
      false,
    );
  assert.equal(
    canShareCredential(
      {
        ...c,
        credential_preferences: {
          ...c.credential_preferences,
          is_public: false,
        },
      },
      recipient,
    ),
    false,
  );
  assert.equal(
    canShareCredential(c, { ...recipient, is_public: false }),
    false,
  );
  assert.equal(canShareCredential(c, null), false);
});
test("presentation refuses private evidence for visitors even if accidentally supplied", () => {
  const c = {
    ...sample(),
    credential_evidence: {
      evidence_url: "https://example.com/private",
      digest_salt: "secret-fixture",
    },
  };
  assert.equal(credentialEvidenceUrl(c, true, false), null);
  assert.equal(credentialEvidenceUrl(c, false, false), null);
  assert.equal(
    credentialEvidenceUrl(c, false, true),
    "https://example.com/private",
  );
  c.credential_preferences.share_evidence = true;
  assert.equal(
    credentialEvidenceUrl(c, true, false),
    "https://example.com/private",
  );
  assert.equal(credentialEvidenceUrl(c, false, false), null);
  assert.equal(safeCredentialWebsite("javascript:alert(1)"), null);
  assert.equal(safeCredentialWebsite("data:text/html,hi"), null);
  assert.equal(
    safeCredentialWebsite("https://example.com"),
    "https://example.com/",
  );
  assert.equal(credentialDate("2025-01-15"), "15 January 2025");
});
test("integrity is never confirmed from a stored receipt or frontend claim alone", async () => {
  const c = sample();
  let calls = 0;
  const checked = async () => {
    calls++;
    return { valid: true, status: "finalized" };
  };
  assert.equal((await credentialIntegrity(c, checked)).state, "pending");
  assert.equal(calls, 0);
  const hash = await credentialHash(credentialClaim(c));
  c.credential_proofs = [
    {
      record_hash: hash,
      signature: "offline-fixture-signature",
      issuer_wallet: "offline-fixture-wallet",
      anchored_at: c.created_at,
    },
  ];
  for (const [result, expected] of [
    [{ valid: true, status: "finalized" }, "verified"],
    [{ valid: true, status: "pending" }, "pending"],
    [{ valid: true }, "missing"],
    [{ valid: false, status: "finalized" }, "missing"],
    [{ valid: false, status: "failed" }, "failed"],
  ] as const)
    assert.equal(
      (await credentialIntegrity(c, async () => result)).state,
      expected,
    );
  assert.equal(
    (
      await credentialIntegrity(c, async () => {
        throw new Error("RPC unavailable");
      })
    ).state,
    "unavailable",
  );
  c.title = "Changed title";
  assert.equal((await credentialIntegrity(c, checked)).state, "mismatch");
  assert.equal(calls, 0);
});
test("visible evidence mismatch blocks verification; hidden evidence commits only its digest", async () => {
  const c = sample();
  c.credential_evidence = {
    evidence_url: "https://example.com/evidence",
    digest_salt: "offline-salt",
  };
  c.evidence_digest = await credentialEvidenceDigest(c.credential_evidence);
  c.credential_proofs = [
    {
      record_hash: await credentialHash(credentialClaim(c)),
      signature: "offline",
      issuer_wallet: "offline",
      anchored_at: c.created_at,
    },
  ];
  const check = async () => ({ valid: true, status: "finalized" });
  assert.equal((await credentialIntegrity(c, check)).state, "verified");
  c.credential_evidence.evidence_url = "https://example.com/changed";
  assert.equal((await credentialIntegrity(c, check)).state, "mismatch");
  c.credential_evidence = null;
  assert.equal((await credentialIntegrity(c, check)).state, "verified");
  c.evidence_digest = "invalid";
  assert.equal((await credentialIntegrity(c, check)).state, "unavailable");
});
test("pending without a record differs from pending finalization, and labels stay scoped", () => {
  assert.equal(integrityLabel("pending", false), "Not recorded");
  assert.equal(integrityLabel("pending", true), "Awaiting finalization");
  for (const state of [
    "pending",
    "unavailable",
    "failed",
    "mismatch",
    "missing",
  ] as const)
    assert.notEqual(integrityLabel(state, true), "Onchain verified");
  assert.equal(integrityLabel("verified", true), "Onchain verified");
});
