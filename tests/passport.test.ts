import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimV2,
  canonicalRecord,
  hashRecord,
  memoFor,
  matchesAnchor,
  MEMO_PROGRAM,
  type ChainEvidence,
} from "../src/lib/proof";
import { passportSteps, safeReturnPath } from "../src/lib/passport";
import { demoProfile, demoProjects } from "../src/lib/demo";
import { achievementRecord, canRecoverLegacy } from "../src/lib/proof-record";
import { verificationState } from "../src/lib/proof-status";
const a = {
  id: "achievement",
  talent_id: "recipient",
  company_id: "issuer",
  title: "Accessible dashboard",
  challenge_id: "challenge",
  submission_id: "submission",
  issued_at: "2026-10-12T00:00:00Z",
};
const snapshot = {
  issuer_name: "Demo issuer",
  evidence_digest: "a".repeat(64),
};
test("v2 protects each significant claim field, while v1 remains unchanged", async () => {
  const original = await hashRecord(claimV2(a, snapshot));
  for (const key of [
    "id",
    "talent_id",
    "company_id",
    "title",
    "challenge_id",
    "submission_id",
    "issued_at",
  ] as const) {
    const changed = {
      ...a,
      [key]: key === "issued_at" ? "2026-10-13T00:00:00Z" : "changed",
    };
    assert.notEqual(
      await hashRecord(claimV2(changed, snapshot)),
      original,
      key,
    );
  }
  assert.notEqual(
    await hashRecord(
      claimV2(a, { ...snapshot, evidence_digest: "b".repeat(64) }),
    ),
    original,
  );
  assert.notEqual(
    await hashRecord(
      claimV2(a, { ...snapshot, issuer_name: "Another issuer" }),
    ),
    original,
  );
  const legacyChanged = { ...a, talent_id: "another", title: "changed" };
  assert.equal(
    await hashRecord(canonicalRecord(a)),
    await hashRecord(canonicalRecord(legacyChanged)),
  );
  assert.equal(
    await hashRecord(
      claimV2({ ...a, issued_at: "2026-10-12T05:00:00+05:00" }, snapshot),
    ),
    original,
  );
});
test("memo versions cannot be confused and failed/pending evidence is never valid", async () => {
  const hash = await hashRecord(claimV2(a, snapshot));
  const tx: ChainEvidence = {
    meta: { err: null },
    transaction: {
      message: {
        accountKeys: [{ signer: true, pubkey: { toBase58: () => "wallet" } }],
        instructions: [
          {
            programId: { toBase58: () => MEMO_PROGRAM },
            parsed: memoFor(hash, 2),
          },
        ],
      },
    },
  };
  assert.equal(matchesAnchor(tx, hash, "wallet", 2), true);
  assert.equal(matchesAnchor(tx, hash, "wallet", 1), false);
  assert.equal(matchesAnchor(null, hash, "wallet", 2), false);
  tx.meta = { err: { failed: true } };
  assert.equal(matchesAnchor(tx, hash, "wallet", 2), false);
});
test("passport can be completed using portfolio work alone, without achievements", () => {
  const profile = { ...demoProfile, passport_previewed_at: "2026-10-12" };
  const projects = demoProjects.map((p) => ({
    ...p,
    demo_url: "https://example.com/demo",
  }));
  assert.equal(
    passportSteps(profile, projects).filter((s) => s.done).length,
    6,
  );
  assert.equal(
    passportSteps(
      {
        ...profile,
        is_public: false,
        headline: "",
        skills: [],
        passport_previewed_at: null,
      },
      [],
    ).filter((s) => s.done).length,
    0,
  );
});
test("return destinations cannot redirect offsite", () => {
  assert.equal(safeReturnPath("//evil.example"), null);
  assert.equal(safeReturnPath("https://evil.example"), null);
  assert.equal(
    safeReturnPath("/challenges/00000000-0000-4000-8000-000000000001#submit"),
    "/challenges/00000000-0000-4000-8000-000000000001#submit",
  );
});
test("v2 verification refuses absent snapshots instead of downgrading to v1", () => {
  assert.throws(() => achievementRecord(a, 2));
  assert.equal(achievementRecord(a, 1).version, 1);
  assert.equal(
    achievementRecord(
      {
        ...a,
        achievement_claims: { ...snapshot, claim_type: "company_challenge" },
      },
      2,
    ).version,
    2,
  );
});
test("verification labels never mark pending, failed, mismatched or unavailable proofs verified", () => {
  assert.equal(
    verificationState({ stored: false, hashMatches: true }),
    "pending",
  );
  assert.equal(
    verificationState({
      stored: true,
      hashMatches: false,
      checked: { valid: true },
    }),
    "mismatch",
  );
  assert.equal(
    verificationState({ stored: true, hashMatches: true, networkError: true }),
    "unavailable",
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
      checked: { valid: false, status: "failed" },
    }),
    "failed",
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

test("legacy recovery accepts historical transactions, not new v1 issuance", () => {
  assert.equal(
    canRecoverLegacy(true, "2026-10-12T00:00:00Z", 1791763199),
    true,
  );
  assert.equal(canRecoverLegacy(false, "2026-10-12T00:00:00Z", 0), false);
  assert.equal(
    canRecoverLegacy(true, "2026-10-12T00:00:00Z", 9999999999),
    false,
  );
});
test("evidence encoding matches the PostgreSQL golden vector and detects content changes", async () => {
  const { evidenceDigest } = await import("../src/lib/proof");
  const e = {
    digest_salt: "salt",
    challenge_title: 'نام "title"',
    challenge_description: "line\nnext",
    deliverables: "demo",
    project_url: "https://example.com/a",
    github_url: "",
    explanation: "Test \\ evidence",
  };
  assert.equal(
    await evidenceDigest(e),
    "0ce8c81d290d6b0e810dbff8d4e6be20c7138ae129bd263e63d53d504411a702",
  );
  assert.notEqual(
    await evidenceDigest({ ...e, explanation: "Changed approved work" }),
    await evidenceDigest(e),
  );
});
