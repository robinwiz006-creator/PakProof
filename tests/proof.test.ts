import { blockhash } from "@solana/kit";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  canonicalRecord,
  serializeRecord,
  hashRecord,
  memoFor,
  matchesAnchor,
  MEMO_PROGRAM,
  explorerLink,
  type ChainEvidence,
} from "../src/lib/proof";
import {
  submissionSchema,
  reviewSchema,
  optionalUrl,
} from "../src/lib/validation";
const achievement = {
  id: "achievement-1",
  challenge_id: "challenge-1",
  company_id: "company-1",
  issued_at: "2026-10-11T12:00:00.123456+00:00",
};
function tx(
  memo: string,
  program = MEMO_PROGRAM,
  signer = true,
  err: unknown = null,
): ChainEvidence {
  return {
    meta: { err },
    transaction: {
      message: {
        accountKeys: [{ pubkey: { toBase58: () => "company-wallet" }, signer }],
        instructions: [
          { programId: { toBase58: () => program }, parsed: memo },
        ],
      },
    },
  };
}
test("canonical record has stable order, UTC precision, and no personal data", async () => {
  const record = canonicalRecord({ ...achievement });
  assert.equal(
    serializeRecord(record),
    '{"version":1,"achievement_id":"achievement-1","challenge_id":"challenge-1","company_id":"company-1","issued_at":"2026-10-11T12:00:00.123Z"}',
  );
  assert.equal(
    await hashRecord(record),
    createHash("sha256").update(serializeRecord(record)).digest("hex"),
  );
  assert.equal(
    await hashRecord(record),
    await hashRecord(
      canonicalRecord({
        issued_at: "2026-10-11T17:00:00.123+05:00",
        company_id: "company-1",
        challenge_id: "challenge-1",
        id: "achievement-1",
      }),
    ),
  );
});
test("changing an achievement changes its hash", async () => {
  assert.notEqual(
    await hashRecord(canonicalRecord(achievement)),
    await hashRecord(
      canonicalRecord({ ...achievement, company_id: "different-company" }),
    ),
  );
});
test("verification requires matching memo program, signer, hash, and successful transaction", async () => {
  const hash = await hashRecord(canonicalRecord(achievement));
  assert.equal(matchesAnchor(tx(memoFor(hash)), hash, "company-wallet"), true);
  assert.equal(
    matchesAnchor(tx(memoFor("a".repeat(64))), hash, "company-wallet"),
    false,
  );
  assert.equal(
    matchesAnchor(tx(memoFor(hash), "other-program"), hash, "company-wallet"),
    false,
  );
  assert.equal(
    matchesAnchor(
      tx(memoFor(hash), MEMO_PROGRAM, false),
      hash,
      "company-wallet",
    ),
    false,
  );
  assert.equal(
    matchesAnchor(
      tx(memoFor(hash), MEMO_PROGRAM, true, {
        InstructionError: [0, "failed"],
      }),
      hash,
      "company-wallet",
    ),
    false,
  );
  assert.equal(matchesAnchor(null, hash, "company-wallet"), false);
  assert.equal(
    matchesAnchor(tx(memoFor(hash)), hash, "different-wallet"),
    false,
  );
});
test("memo validates hash and explorer stays on devnet", () => {
  assert.throws(() => memoFor("fake"));
  assert.match(explorerLink("abc"), /\?cluster=devnet$/);
});
test("submissions require evidence and safe URLs", () => {
  const base = {
    challenge_id: "00000000-0000-4000-8000-000000000001",
    explanation: "A detailed explanation of my implementation decisions.",
    github_url: "",
    project_url: "",
  };
  assert.equal(submissionSchema.safeParse(base).success, false);
  assert.equal(
    submissionSchema.safeParse({
      ...base,
      project_url: "https://example.com/project",
    }).success,
    true,
  );
  assert.equal(optionalUrl.safeParse("javascript:alert(1)").success, false);
  assert.equal(optionalUrl.safeParse("data:text/html,hi").success, false);
});
test("reviews accept only protected transitions with feedback", () => {
  const base = {
    submission_id: "00000000-0000-4000-8000-000000000001",
    feedback: "Reviewed the deployed dashboard and repository.",
  };
  assert.equal(
    reviewSchema.safeParse({ ...base, decision: "approved" }).success,
    true,
  );
  assert.equal(
    reviewSchema.safeParse({ ...base, decision: "verified" }).success,
    false,
  );
  assert.equal(
    reviewSchema.safeParse({ ...base, decision: "approved", feedback: "" })
      .success,
    false,
  );
});
test("current Solana SDK serializes and signs a real memo transaction", async () => {
  const { Keypair, PublicKey, Transaction, TransactionInstruction } =
    await import("@solana/web3.js");
  const { Buffer } = await import("buffer");
  const signer = await Keypair.generate();
  const hash = await hashRecord(canonicalRecord(achievement));
  const transaction = new Transaction({
    feePayer: signer.publicKey,
    recentBlockhash: blockhash((await Keypair.generate()).publicKey.toBase58()),
  }).add(
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(memoFor(hash)),
    }),
  );
  const unsigned = await transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  assert.ok(unsigned.length > 0);
  await transaction.sign(signer);
  const bytes = await transaction.serialize();
  const decoded = Transaction.from(bytes);
  assert.equal(decoded.instructions[0].programId.toBase58(), MEMO_PROGRAM);
  assert.equal(
    Buffer.from(decoded.instructions[0].data).toString(),
    memoFor(hash),
  );
  assert.equal(decoded.feePayer?.toBase58(), signer.publicKey.toBase58());
  assert.ok(decoded.signature);
});
