import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "solana-web3-legacy";
import {
  captureProof,
  broadcastSavedProof,
  clearSavedProof,
  signatureStatus,
  preparePaymentContext,
  paymentSigning,
  paymentRejection,
  saveSignedPayment,
  clearUnsignedPayment,
  clearSettledPayment,
  paymentBlocked,
  paymentLocalRisk,
  paymentContextKey,
  type PaymentContext,
} from "../src/lib/transaction-recovery";
class Memory implements Storage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}
function proofFixture() {
  const payer = Keypair.generate();
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
  }).add(
    new TransactionInstruction({
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from("proofpak:v3:" + "a".repeat(64)),
    }),
  );
  const template = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  tx.sign(payer);
  return {
    template,
    signed: tx.serialize(),
    input: {
      wallet: payer.publicKey.toBase58(),
      claimVersion: 3 as const,
      hash: "a".repeat(64),
      blockhash: tx.recentBlockhash!,
      lastValidBlockHeight: "100",
    },
  };
}
test("proof saves original bytes and signature before any broadcast; refresh never signs a replacement", async () => {
  const storage = new Memory(),
    f = proofFixture();
  let signs = 0;
  const saved = await captureProof(
    storage,
    "proof",
    f.input,
    f.template,
    async () => {
      signs++;
      assert.equal(
        JSON.parse(storage.getItem("proof")!).stage,
        "awaiting_signature",
      );
      return f.signed;
    },
  );
  assert.equal(signs, 1);
  assert.equal(
    JSON.parse(storage.getItem("proof")!).signature,
    saved.signature,
  );
  await assert.rejects(
    () =>
      captureProof(storage, "proof", f.input, f.template, async () => {
        signs++;
        return f.signed;
      }),
    /existing proof/,
  );
  assert.equal(signs, 1);
  const broadcasts: string[] = [];
  await assert.rejects(
    () =>
      broadcastSavedProof(storage, "proof", {
        sendRawTransaction: async (bytes) => {
          broadcasts.push(Buffer.from(bytes).toString("base64"));
          throw new Error("RPC acknowledgement lost");
        },
      }),
    /acknowledgement lost/,
  );
  assert.equal(
    JSON.parse(storage.getItem("proof")!).signature,
    saved.signature,
  );
  await broadcastSavedProof(storage, "proof", {
    sendRawTransaction: async (bytes) => {
      broadcasts.push(Buffer.from(bytes).toString("base64"));
      return saved.signature;
    },
  });
  assert.equal(broadcasts[0], broadcasts[1]);
  assert.equal(JSON.parse(storage.getItem("proof")!).stage, "submitted");
  assert.equal(clearSavedProof(storage, "proof", "different-signature"), false);
  assert.ok(storage.getItem("proof"));
  clearSavedProof(storage, "proof", saved.signature);
  assert.equal(storage.getItem("proof"), null);
});
test("only explicit wallet rejection releases proof signing reservation; unknown error and unavailable storage fail closed", async () => {
  const f = proofFixture(),
    s = new Memory();
  await assert.rejects(() =>
    captureProof(s, "proof", f.input, f.template, async () => {
      throw Object.assign(new Error("Rejected"), { code: 4001 });
    }),
  );
  assert.equal(s.getItem("proof"), null);
  await assert.rejects(() =>
    captureProof(s, "proof", f.input, f.template, async () => {
      throw new Error("Wallet timeout");
    }),
  );
  assert.equal(JSON.parse(s.getItem("proof")!).stage, "awaiting_signature");
  const failing = new Memory();
  let writes = 0;
  failing.setItem = (k, v) => {
    if (++writes > 1) throw new Error("Storage quota");
    failing.map.set(k, v);
  };
  await assert.rejects(
    () =>
      captureProof(failing, "proof", f.input, f.template, async () => f.signed),
    /Storage quota/,
  );
  assert.equal(
    JSON.parse(failing.getItem("proof")!).stage,
    "awaiting_signature",
  );
});
test("changed signed proof template is rejected and leaves a recovery lock", async () => {
  const f = proofFixture(),
    other = proofFixture(),
    s = new Memory();
  await assert.rejects(
    () =>
      captureProof(s, "proof", f.input, f.template, async () => other.signed),
    /changed or invalid/,
  );
  assert.ok(s.getItem("proof"));
});
const context: PaymentContext = {
  schema: 1,
  attemptId: "attempt",
  intentId: "intent",
  milestoneId: "milestone",
  recipient: "expected-recipient",
  mint: "expected-devnet-mint",
  amount: "1250000",
  stage: "unsigned",
};
const cancelled = {
  id: "attempt",
  intent_id: "intent",
  signature: null,
  status: "cancelled",
};
test("confirmed unsigned cancellation cleans only its own unsigned preparation, including safe stale guard", () => {
  const s = new Memory();
  preparePaymentContext(s, context);
  assert.equal(paymentBlocked(s, "milestone"), false);
  s.setItem("proofpak:milestone-signed:milestone", "attempt");
  assert.equal(
    clearUnsignedPayment(s, { ...cancelled, intent_id: "other" }),
    false,
  );
  assert.equal(clearUnsignedPayment(s, cancelled), true);
  assert.equal(paymentBlocked(s, "milestone"), false);
  assert.equal(s.getItem(paymentContextKey("attempt")), null);
  assert.equal(clearUnsignedPayment(s, cancelled), false);
});
test("interrupted signing and signed/legacy attempts survive cancellation; explicit rejection safely unlocks", () => {
  const s = new Memory();
  preparePaymentContext(s, context);
  paymentSigning(s, "attempt");
  assert.equal(paymentBlocked(s, "milestone"), true);
  assert.equal(clearUnsignedPayment(s, cancelled), false);
  assert.equal(paymentRejection(s, "attempt", new Error("Timeout")), false);
  assert.equal(paymentRejection(s, "attempt", { cause: { code: 4001 } }), true);
  assert.equal(paymentBlocked(s, "milestone"), false);
  paymentSigning(s, "attempt");
  saveSignedPayment(
    s,
    "attempt",
    "original-signature",
    "original-signed-bytes",
  );
  assert.equal(clearUnsignedPayment(s, cancelled), false);
  assert.equal(paymentLocalRisk(s, "attempt"), true);
  const stored = JSON.parse(s.getItem(paymentContextKey("attempt"))!);
  assert.equal(stored.recipient, context.recipient);
  assert.equal(stored.mint, context.mint);
  assert.equal(stored.amount, "1250000");
  assert.equal(
    clearSettledPayment(s, {
      id: "attempt",
      status: "pending",
      signature: "original-signature",
    }),
    false,
  );
  assert.equal(
    clearSettledPayment(s, {
      id: "attempt",
      status: "paid",
      signature: "different",
    }),
    false,
  );
  assert.equal(
    clearSettledPayment(s, {
      id: "attempt",
      status: "paid",
      signature: "original-signature",
    }),
    true,
  );
  assert.equal(paymentBlocked(s, "milestone"), false);
  s.setItem("proofpak:milestone-signed:milestone", "legacy-attempt");
  assert.equal(
    clearUnsignedPayment(s, { ...cancelled, id: "legacy-attempt" }),
    false,
  );
});
test("only finalized failure unlocks failed-proof recovery; processed/confirmed errors remain pending", () => {
  assert.equal(signatureStatus(null), "not_found");
  for (const confirmationStatus of ["processed", "confirmed"])
    assert.equal(
      signatureStatus({ confirmationStatus, err: { failure: true } }),
      "pending",
    );
  assert.equal(
    signatureStatus({
      confirmationStatus: "finalized",
      err: { failure: true },
    }),
    "failed",
  );
  assert.equal(
    signatureStatus({ confirmationStatus: "finalized", err: null }),
    "finalized",
  );
});

test("tampered proof storage cannot turn original proof replay into an unrelated signed transaction", async () => {
  const f = proofFixture(),
    s = new Memory();
  const record = await captureProof(
    s,
    "proof",
    f.input,
    f.template,
    async () => f.signed,
  );
  s.setItem("proof", JSON.stringify({ ...record, hash: "b".repeat(64) }));
  let sent = false;
  await assert.rejects(
    () =>
      broadcastSavedProof(s, "proof", {
        sendRawTransaction: async () => {
          sent = true;
          return record.signature;
        },
      }),
    /mismatch/,
  );
  assert.equal(sent, false);
  const unavailable = new Memory();
  unavailable.getItem = () => {
    throw new Error("Storage unavailable");
  };
  assert.equal(clearSavedProof(unavailable, "proof", record.signature), false);
});
