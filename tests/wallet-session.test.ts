import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
} from "solana-web3-legacy";
import {
  sessionWallet,
  withWalletTimeout,
  type SigningSession,
} from "../src/lib/wallet-session";
import type {
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { MEMO_PROGRAM } from "../src/lib/proof";
import { TOKEN_PROGRAM, TEST_USDC_MINT } from "../src/lib/payments";
import { verifyOwnership, ownershipMessage } from "../src/lib/wallet-ownership";
function fixture() {
  const key = Keypair.generate();
  const session: SigningSession = {
    address: key.publicKey.toBase58(),
    devnet: true,
    methods: ["solana_signMessage", "solana_signTransaction"],
    signMessage: async () => new Uint8Array(64),
    signTransaction: async (tx) => {
      tx.partialSign(key);
      return tx;
    },
    disconnect: async () => {},
  };
  return { key, session, wallet: sessionWallet(() => session) };
}
test("relay requires both sign-message and sign-only transaction capabilities", () => {
  const { session } = fixture();
  assert.throws(
    () =>
      sessionWallet(() => ({ ...session, methods: ["solana_signMessage"] })),
    /solana_signTransaction/,
  );
  assert.throws(
    () => sessionWallet(() => ({ ...session, devnet: false })),
    /devnet/,
  );
});
test("relay rejects changed accounts and networks, invalid signatures, and provider rejection", async () => {
  const { session, wallet } = fixture();
  const message = wallet.features[
    "solana:signMessage"
  ] as SolanaSignMessageFeature["solana:signMessage"];
  const input = {
    account: wallet.accounts[0],
    message: new TextEncoder().encode("fixture"),
  };
  session.address = Keypair.generate().publicKey.toBase58();
  await assert.rejects(message.signMessage(input), /changed/);
  session.address = input.account.address;
  session.devnet = false;
  await assert.rejects(message.signMessage(input), /changed/);
  session.devnet = true;
  session.signMessage = async () => new Uint8Array(2);
  await assert.rejects(message.signMessage(input), /invalid/);
  session.signMessage = async () => {
    throw new Error("User rejected");
  };
  await assert.rejects(message.signMessage(input), /rejected/);
});
test("relay signing timeout does not return a success", async () => {
  await assert.rejects(
    withWalletTimeout(new Promise(() => {}), 5),
    /timed out/,
  );
});
test("real offline ownership signatures through relay bridge bind server purpose", async () => {
  const keys = generateKeyPairSync("ed25519");
  const address = getBase58Decoder().decode(
    Buffer.from(keys.publicKey.export({ format: "jwk" }).x!, "base64url"),
  );
  const { session } = fixture();
  session.address = address;
  session.signMessage = async (message) =>
    new Uint8Array(sign(null, message, keys.privateKey));
  const wallet = sessionWallet(() => session);
  const values = {
    domain: "https://example.com",
    userId: "fixture",
    wallet: address,
    purpose: "account",
    organizationId: null,
    nonce: "fixture",
    issuedAt: "2026-10-13T00:00:00Z",
    expiresAt: "2026-10-13T00:05:00Z",
  };
  const text = ownershipMessage(values);
  const [signed] = await (
    wallet.features[
      "solana:signMessage"
    ] as SolanaSignMessageFeature["solana:signMessage"]
  ).signMessage({
    account: wallet.accounts[0],
    message: new TextEncoder().encode(text),
  });
  const signature = Buffer.from(signed.signature).toString("base64");
  assert.ok(verifyOwnership(address, text, signature));
  assert.equal(
    verifyOwnership(
      address,
      ownershipMessage({ ...values, purpose: "company_payer" }),
      signature,
    ),
    false,
  );
});
for (const kind of ["Memo credential", "SPL transfer"])
  test(`offline ${kind} signing preserves exact bytes without broadcast`, async () => {
    const { key, wallet } = fixture();
    const program = new PublicKey(
      kind === "Memo credential" ? MEMO_PROGRAM : TOKEN_PROGRAM,
    );
    const tokenData = Buffer.alloc(10);
    tokenData[0] = 12; // SPL TransferChecked, exact integer test units.
    tokenData.writeBigUInt64LE(1_250_000n, 1);
    tokenData[9] = 6;
    const keys =
      kind === "Memo credential"
        ? []
        : [
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: new PublicKey(TEST_USDC_MINT),
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            { pubkey: key.publicKey, isSigner: true, isWritable: false },
          ];
    const tx = new Transaction({
      feePayer: key.publicKey,
      recentBlockhash: Keypair.generate().publicKey.toBase58(),
    }).add(
      new TransactionInstruction({
        programId: program,
        keys,
        data:
          kind === "Memo credential"
            ? Buffer.from("proofpak:v3:" + "a".repeat(64))
            : tokenData,
      }),
    );
    const [signed] = await (
      wallet.features[
        "solana:signTransaction"
      ] as SolanaSignTransactionFeature["solana:signTransaction"]
    ).signTransaction({
      account: wallet.accounts[0],
      chain: "solana:devnet",
      transaction: tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    });
    const result = Transaction.from(signed.signedTransaction);
    assert.deepEqual(result.serializeMessage(), tx.serializeMessage());
    assert.ok(result.verifySignatures());
  });
test("changed transaction is rejected and disconnect reaches provider", async () => {
  const { key, session, wallet } = fixture();
  const tx = new Transaction({
    feePayer: key.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(
    new TransactionInstruction({
      programId: key.publicKey,
      keys: [],
      data: Buffer.from("original"),
    }),
  );
  session.signTransaction = async (tx) => {
    tx.instructions[0].data = Buffer.from("changed");
    tx.partialSign(key);
    return tx;
  };
  await assert.rejects(
    (
      wallet.features[
        "solana:signTransaction"
      ] as SolanaSignTransactionFeature["solana:signTransaction"]
    ).signTransaction({
      account: wallet.accounts[0],
      chain: "solana:devnet",
      transaction: tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    }),
    /changed the transaction/,
  );
  let disconnected = false;
  session.disconnect = async () => {
    disconnected = true;
  };
  await (
    wallet.features["standard:disconnect"] as { disconnect(): Promise<void> }
  ).disconnect();
  assert.ok(disconnected);
});
test("disconnected session rejects signing and a new connection gets a fresh account", async () => {
  const { session } = fixture();
  let active = true;
  const wallet = sessionWallet(() => {
    if (!active) throw new Error("Disconnected");
    return session;
  });
  active = false;
  await assert.rejects(
    (
      wallet.features[
        "solana:signMessage"
      ] as SolanaSignMessageFeature["solana:signMessage"]
    ).signMessage({
      account: wallet.accounts[0],
      message: new Uint8Array([1]),
    }),
    /Disconnected/,
  );
  active = true;
  session.address = Keypair.generate().publicKey.toBase58();
  const replacement = sessionWallet(() => session);
  assert.notEqual(replacement.accounts[0].address, wallet.accounts[0].address);
});
test("production milestone template signed through bridge passes existing backend registration verifier", async () => {
  const { buildPaymentTransaction, tokenAccount, validateSignedPayment } =
    await import("../src/lib/payment-chain");
  const { key, wallet } = fixture();
  const recipient = Keypair.generate().publicKey.toBase58();
  const intent = {
    id: "10000000-0000-4000-8000-000000000001",
    milestone_id: "20000000-0000-4000-8000-000000000001",
    offer_id: "30000000-0000-4000-8000-000000000001",
    approval_id: "40000000-0000-4000-8000-000000000001",
    terms_hash: "a".repeat(64),
    amount_units: "1250000",
    payer_user_id: "50000000-0000-4000-8000-000000000001",
    payer_connection_id: "60000000-0000-4000-8000-000000000001",
    payer_wallet: key.publicKey.toBase58(),
    source_account: await tokenAccount(key.publicKey.toBase58()),
    payout_authorization_id: "70000000-0000-4000-8000-000000000001",
    recipient_connection_id: "80000000-0000-4000-8000-000000000001",
    recipient_wallet: recipient,
    destination_account: await tokenAccount(recipient),
    nonce: "90000000-0000-4000-8000-000000000001",
    network: "devnet",
    mint: TEST_USDC_MINT,
    token_program: TOKEN_PROGRAM,
    decimals: 6,
    status: "prepared",
  } as const;
  const blockhash = Keypair.generate().publicKey.toBase58();
  const template = await buildPaymentTransaction(intent, {
    blockhash,
    lastValidBlockHeight: 1000n,
  });
  const bytes = await template.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  const [signed] = await (
    wallet.features[
      "solana:signTransaction"
    ] as SolanaSignTransactionFeature["solana:signTransaction"]
  ).signTransaction({
    account: wallet.accounts[0],
    chain: "solana:devnet",
    transaction: bytes,
  });
  const attempt = {
    id: "a0000000-0000-4000-8000-000000000001",
    intent_id: intent.id,
    template_base64: Buffer.from(bytes).toString("base64"),
    blockhash,
    last_valid_block_height: "1000",
    signature: null,
    signed_base64: null,
    status: "prepared",
    status_note: "",
    created_at: "2026-10-13",
  } as const;
  const registered = await validateSignedPayment(
    attempt,
    Buffer.from(signed.signedTransaction).toString("base64"),
  );
  assert.ok(registered.signature);
  assert.equal(
    registered.signedBase64,
    Buffer.from(signed.signedTransaction).toString("base64"),
  );
});
