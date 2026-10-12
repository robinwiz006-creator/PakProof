import test from "node:test";
import assert from "node:assert/strict";
import {
  credentialClaim,
  credentialHash,
  serializeCredential,
  credentialEvidenceDigest,
  matchesCredentialAnchor,
  credentialMemo,
} from "../src/lib/credential-proof";
import { MEMO_PROGRAM, type ChainEvidence } from "../src/lib/proof";
import { verificationState } from "../src/lib/proof-status";
import type { Credential } from "../src/lib/credentials";
const c: Credential = {
  id: "10000000-0000-4000-8000-000000000001",
  organization_id: "20000000-0000-4000-8000-000000000001",
  authorization_id: "30000000-0000-4000-8000-000000000001",
  recipient_id: "40000000-0000-4000-8000-000000000001",
  issuer_name: "Fixture Organization",
  title: "Hackathon Winner",
  credential_type: "hackathon_achievement",
  description: "An isolated fixture claim, not a real award.",
  issue_date: "2026-10-12",
  expiry_date: null,
  program_name: "Fixture event",
  award: "First Place",
  evidence_digest: "a".repeat(64),
  created_at: "2026-10-12T00:00:00+00:00",
  credential_preferences: {
    acceptance: "accepted",
    is_public: true,
    share_evidence: false,
  },
  credential_events: [],
};
test("v3 canonical claim protects every issued fact, independent of property insertion order", async () => {
  const claim = credentialClaim(c),
    hash = await credentialHash(claim);
  const reordered = Object.fromEntries(
    Object.entries(claim).reverse(),
  ) as typeof claim;
  assert.equal(await credentialHash(reordered), hash);
  for (const field of [
    "credential_id",
    "recipient_id",
    "issuer_id",
    "issuer_name",
    "issuer_authorization_id",
    "title",
    "credential_type",
    "description",
    "issue_date",
    "expiry_date",
    "program_name",
    "award",
    "evidence_digest",
    "created_at",
  ] as const) {
    const changed = {
      ...claim,
      [field]: field === "evidence_digest" ? "b".repeat(64) : "different",
    };
    assert.notEqual(await credentialHash(changed), hash, field);
  }
  assert.ok(!serializeCredential(claim).includes("email"));
});
test("v3 evidence digest uses a salted, deterministic private reference", async () => {
  const e = {
    digest_salt: "00000000-0000-4000-8000-000000000001",
    evidence_url: "https://example.com/private-degree",
  };
  const hash = await credentialEvidenceDigest(e);
  assert.equal(hash, await credentialEvidenceDigest(e));
  assert.equal(
    hash,
    "8c492cbfa8a41270214e3423cfbdbc3ed65834fcf0cdd168fe2a5a843824c575",
  );
  assert.notEqual(
    hash,
    await credentialEvidenceDigest({
      ...e,
      evidence_url: "https://example.com/changed",
    }),
  );
  assert.notEqual(
    hash,
    await credentialEvidenceDigest({
      ...e,
      digest_salt: "00000000-0000-4000-8000-000000000002",
    }),
  );
});
test("v3 proof fixtures reject wrong signer, memo version, program, hash and failed transactions", () => {
  const hash = "a".repeat(64),
    wallet = "fixture-wallet";
  function fixture(
    memo: string,
    signer = true,
    program = MEMO_PROGRAM,
    err: unknown = null,
  ): ChainEvidence {
    return {
      meta: { err },
      transaction: {
        message: {
          accountKeys: [{ pubkey: { toBase58: () => wallet }, signer }],
          instructions: [
            { programId: { toBase58: () => program }, parsed: memo },
          ],
        },
      },
    };
  }
  assert.ok(
    matchesCredentialAnchor(fixture(credentialMemo(hash)), hash, wallet),
  );
  assert.ok(
    !matchesCredentialAnchor(fixture(`proofpak:v2:${hash}`), hash, wallet),
  );
  assert.ok(
    !matchesCredentialAnchor(
      fixture(credentialMemo(hash), false),
      hash,
      wallet,
    ),
  );
  assert.ok(
    !matchesCredentialAnchor(
      fixture(credentialMemo(hash), true, "other-program"),
      hash,
      wallet,
    ),
  );
  assert.ok(
    !matchesCredentialAnchor(
      fixture(credentialMemo(hash), true, MEMO_PROGRAM, { failed: true }),
      hash,
      wallet,
    ),
  );
  assert.ok(
    !matchesCredentialAnchor(
      fixture(credentialMemo("b".repeat(64))),
      hash,
      wallet,
    ),
  );
  assert.equal(
    verificationState({
      stored: true,
      hashMatches: true,
      checked: { valid: false, status: "pending" },
    }),
    "pending",
  );
  assert.equal(
    verificationState({
      stored: true,
      hashMatches: true,
      checked: { valid: true, status: "pending" },
    }),
    "pending",
  );
  assert.equal(
    verificationState({
      stored: true,
      hashMatches: true,
      checked: { valid: true, status: "finalized" },
    }),
    "verified",
  );
});
