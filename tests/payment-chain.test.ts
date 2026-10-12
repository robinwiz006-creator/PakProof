import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import { blockhash } from "@solana/kit";
import { Buffer } from "buffer";
import {
  buildPaymentTransaction,
  tokenAccount,
  validateSignedPayment,
  verifyPaymentSettlement,
  paymentMemo,
  type PaymentChainEvidence,
} from "../src/lib/payment-chain";
import {
  TEST_USDC_MINT,
  TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  type PaymentIntent,
  type PaymentAttempt,
} from "../src/lib/payments";
import { MEMO_PROGRAM } from "../src/lib/proof";
async function fixture() {
  const payer = await Keypair.generate(),
    recipient = await Keypair.generate();
  const i: PaymentIntent = {
    id: "10000000-0000-4000-8000-000000000001",
    milestone_id: "20000000-0000-4000-8000-000000000001",
    offer_id: "30000000-0000-4000-8000-000000000001",
    approval_id: "40000000-0000-4000-8000-000000000001",
    terms_hash: "a".repeat(64),
    amount_units: "1250000",
    payer_user_id: "50000000-0000-4000-8000-000000000001",
    payer_connection_id: "60000000-0000-4000-8000-000000000001",
    payer_wallet: payer.publicKey.toBase58(),
    source_account: await tokenAccount(payer.publicKey.toBase58()),
    payout_authorization_id: "70000000-0000-4000-8000-000000000001",
    recipient_connection_id: "80000000-0000-4000-8000-000000000001",
    recipient_wallet: recipient.publicKey.toBase58(),
    destination_account: await tokenAccount(recipient.publicKey.toBase58()),
    nonce: "90000000-0000-4000-8000-000000000001",
    network: "devnet",
    mint: TEST_USDC_MINT,
    token_program: TOKEN_PROGRAM,
    decimals: 6,
    status: "prepared",
  };
  const latest = {
    blockhash: blockhash((await Keypair.generate()).publicKey.toBase58()),
    lastValidBlockHeight: 1000n,
  };
  const tx = await buildPaymentTransaction(i, latest);
  const a: PaymentAttempt = {
    id: "a0000000-0000-4000-8000-000000000001",
    intent_id: i.id,
    template_base64: Buffer.from(
      await tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    ).toString("base64"),
    blockhash: latest.blockhash,
    last_valid_block_height: "1000",
    signature: null,
    signed_base64: null,
    status: "prepared",
    status_note: "",
    created_at: "2026-10-12",
  };
  await tx.sign(payer);
  const bytes = Buffer.from(await tx.serialize()).toString("base64");
  const signed = await validateSignedPayment(a, bytes);
  a.signature = signed.signature;
  a.signed_base64 = signed.signedBase64;
  const balance = (index: number, owner: string, amount: string) => ({
    accountIndex: index,
    mint: TEST_USDC_MINT,
    owner,
    programId: TOKEN_PROGRAM,
    uiTokenAmount: { amount, decimals: 6 },
  });
  const evidence: PaymentChainEvidence = {
    finalized: true,
    rawBase64: bytes,
    err: null,
    accounts: [
      { address: i.payer_wallet, signer: true },
      { address: i.source_account, signer: false },
      { address: i.destination_account, signer: false },
    ],
    instructions: [
      {
        programId: ASSOCIATED_TOKEN_PROGRAM,
        parsed: { type: "createIdempotent" },
      },
      {
        programId: TOKEN_PROGRAM,
        parsed: {
          type: "transferChecked",
          info: {
            source: i.source_account,
            destination: i.destination_account,
            authority: i.payer_wallet,
            mint: i.mint,
            tokenAmount: { amount: i.amount_units, decimals: 6 },
          },
        },
      },
      { programId: MEMO_PROGRAM, parsed: await paymentMemo(i) },
    ],
    preBalances: [balance(1, i.payer_wallet, "10000000")],
    postBalances: [
      balance(1, i.payer_wallet, "8750000"),
      balance(2, i.recipient_wallet, "1250000"),
    ],
    blockTime: 1791763200,
  };
  return { i, a, evidence, payer };
}
test("offline real SPL TransferChecked is signed, serialized and pinned to its template", async () => {
  const { i, a, payer } = await fixture();
  const decoded = Transaction.from(Buffer.from(a.signed_base64!, "base64"));
  assert.equal(decoded.instructions[1].programId.toBase58(), TOKEN_PROGRAM);
  assert.equal(decoded.instructions[1].data[0], 12);
  assert.equal(
    Buffer.from(decoded.instructions[1].data).readBigUInt64LE(1),
    1250000n,
  );
  assert.equal(decoded.instructions[1].data[9], 6);
  assert.equal(
    decoded.instructions[1].keys[2].pubkey.toBase58(),
    i.destination_account,
  );
  const altered = Transaction.from(Buffer.from(a.template_base64, "base64"));
  altered.instructions[1].data[1] ^= 1;
  await altered.sign(payer);
  await assert.rejects(
    validateSignedPayment(
      a,
      Buffer.from(await altered.serialize()).toString("base64"),
    ),
  );
  const extra = Transaction.from(Buffer.from(a.template_base64, "base64"));
  extra.add(
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [],
      data: Buffer.from("extra"),
    }),
  );
  await extra.sign(payer);
  await assert.rejects(
    validateSignedPayment(
      a,
      Buffer.from(await extra.serialize()).toString("base64"),
    ),
  );
});
test("offline settlement fixtures require the exact finalized transfer and historical owner balances", async () => {
  const { i, a, evidence } = await fixture();
  assert.equal((await verifyPaymentSettlement(i, a, evidence)).status, "paid");
  const mutations: [string, (tx: PaymentChainEvidence) => void][] = [
    [
      "pending transaction",
      (tx) => {
        tx.finalized = false;
      },
    ],
    [
      "wrong mint",
      (tx) => {
        (tx.instructions[1].parsed as { info: { mint: string } }).info.mint =
          "other";
      },
    ],
    [
      "underpayment",
      (tx) => {
        (
          tx.instructions[1].parsed as {
            info: { tokenAmount: { amount: string } };
          }
        ).info.tokenAmount.amount = "1249999";
      },
    ],
    [
      "overpayment",
      (tx) => {
        (
          tx.instructions[1].parsed as {
            info: { tokenAmount: { amount: string } };
          }
        ).info.tokenAmount.amount = "1250001";
      },
    ],
    [
      "wrong authority",
      (tx) => {
        (
          tx.instructions[1].parsed as { info: { authority: string } }
        ).info.authority = i.recipient_wallet;
      },
    ],
    [
      "wrong recipient",
      (tx) => {
        tx.postBalances[1].owner = i.payer_wallet;
      },
    ],
    [
      "wrong decimals",
      (tx) => {
        tx.postBalances[1].uiTokenAmount.decimals = 9;
      },
    ],
    [
      "missing historical owner",
      (tx) => {
        delete tx.preBalances[0].owner;
      },
    ],
    [
      "wrong token program",
      (tx) => {
        tx.postBalances[1].programId = "other";
      },
    ],
    [
      "balance mismatch",
      (tx) => {
        tx.postBalances[1].uiTokenAmount.amount = "1249999";
      },
    ],
    [
      "unrelated memo",
      (tx) => {
        tx.instructions[2].parsed = "unrelated";
      },
    ],
    [
      "extra instruction",
      (tx) => {
        tx.instructions.push({ programId: TOKEN_PROGRAM });
      },
    ],
    [
      "unregistered bytes",
      (tx) => {
        tx.rawBase64 = Buffer.from("different").toString("base64");
      },
    ],
    [
      "missing success metadata",
      (tx) => {
        tx.err = undefined;
      },
    ],
  ];
  for (const [name, mutate] of mutations) {
    const tx = structuredClone(evidence);
    mutate(tx);
    assert.equal(
      (await verifyPaymentSettlement(i, a, tx)).status,
      "needs_review",
      name,
    );
  }
  assert.equal(
    (
      await verifyPaymentSettlement(i, a, {
        ...evidence,
        err: { InstructionError: [1, "InsufficientFunds"] },
      })
    ).status,
    "failed",
  );
});
test("payment digest binds milestone, approval, accepted terms, destination and integer amount", async () => {
  const { i } = await fixture();
  for (const change of [
    { milestone_id: "other" },
    { approval_id: "other" },
    { terms_hash: "b".repeat(64) },
    { recipient_wallet: i.payer_wallet },
    { amount_units: "1250001" },
    { nonce: "other" },
  ])
    assert.notEqual(
      await paymentMemo({ ...i, ...change }),
      await paymentMemo(i),
    );
});
