import { PaymentError } from "./payment-error";
import { Buffer } from "buffer";
import { getBase58Decoder } from "@solana/kit";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { MEMO_PROGRAM } from "./proof";
import {
  TEST_USDC_MINT,
  TOKEN_PROGRAM,
  ASSOCIATED_TOKEN_PROGRAM,
  type PaymentIntent,
  type PaymentAttempt,
} from "./payments";
export async function tokenAccount(wallet: string) {
  return (
    await PublicKey.findProgramAddress(
      [
        new PublicKey(wallet).toBytes(),
        new PublicKey(TOKEN_PROGRAM).toBytes(),
        new PublicKey(TEST_USDC_MINT).toBytes(),
      ],
      new PublicKey(ASSOCIATED_TOKEN_PROGRAM),
    )
  )[0].toBase58();
}
export async function intentDigest(i: PaymentIntent) {
  const value = JSON.stringify({
    version: 1,
    intent_id: i.id,
    milestone_id: i.milestone_id,
    approval_id: i.approval_id,
    offer_id: i.offer_id,
    terms_hash: i.terms_hash,
    amount_units: i.amount_units,
    payer_wallet: i.payer_wallet,
    source_account: i.source_account,
    payout_authorization_id: i.payout_authorization_id,
    recipient_wallet: i.recipient_wallet,
    destination_account: i.destination_account,
    nonce: i.nonce,
    network: i.network,
    mint: i.mint,
    token_program: i.token_program,
    decimals: i.decimals,
  });
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function paymentMemo(i: PaymentIntent) {
  return `proofpak:payment:v1:${i.id}:${await intentDigest(i)}`;
}
export async function buildPaymentTransaction(
  i: PaymentIntent,
  latest: { blockhash: string; lastValidBlockHeight: bigint },
) {
  if (
    i.network !== "devnet" ||
    i.mint !== TEST_USDC_MINT ||
    i.token_program !== TOKEN_PROGRAM ||
    i.decimals !== 6 ||
    BigInt(i.amount_units) <= 0n ||
    BigInt(i.amount_units) > 1000000000000n ||
    i.payer_wallet === i.recipient_wallet
  )
    throw new PaymentError("Unsupported payment configuration.");
  if (
    (await tokenAccount(i.payer_wallet)) !== i.source_account ||
    (await tokenAccount(i.recipient_wallet)) !== i.destination_account
  )
    throw new PaymentError(
      "Payment token accounts do not match their wallet owners.",
    );
  const payer = new PublicKey(i.payer_wallet),
    mint = new PublicKey(TEST_USDC_MINT),
    source = new PublicKey(i.source_account),
    destination = new PublicKey(i.destination_account);
  const checked = Buffer.alloc(10);
  checked[0] = 12;
  checked.writeBigUInt64LE(BigInt(i.amount_units), 1);
  checked[9] = 6;
  return new Transaction({ feePayer: payer, ...latest }).add(
    new TransactionInstruction({
      programId: new PublicKey(ASSOCIATED_TOKEN_PROGRAM),
      keys: [
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        {
          pubkey: new PublicKey(i.recipient_wallet),
          isSigner: false,
          isWritable: false,
        },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        {
          pubkey: new PublicKey(TOKEN_PROGRAM),
          isSigner: false,
          isWritable: false,
        },
      ],
      data: Buffer.from([1]),
    }),
    new TransactionInstruction({
      programId: new PublicKey(TOKEN_PROGRAM),
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: false },
      ],
      data: checked,
    }),
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(await paymentMemo(i), "utf8"),
    }),
  );
}
export async function validateSignedPayment(
  attempt: PaymentAttempt,
  signedBase64: string,
) {
  const bytes = Buffer.from(signedBase64, "base64");
  if (bytes.length > 1232 || !bytes.length)
    throw new PaymentError("Invalid transaction size.");
  const signed = Transaction.from(bytes),
    template = Transaction.from(Buffer.from(attempt.template_base64, "base64"));
  if (
    !Buffer.from(await signed.serializeMessage()).equals(
      Buffer.from(await template.serializeMessage()),
    ) ||
    !(await signed.verifySignatures()) ||
    !signed.signature
  )
    throw new PaymentError(
      "Wallet changed the payment or returned an invalid signature. Nothing will be broadcast.",
    );
  return {
    signature: getBase58Decoder().decode(signed.signature),
    signedBase64: bytes.toString("base64"),
  };
}
export type HistoricalTokenBalance = {
  accountIndex: number;
  mint: string;
  owner?: string;
  programId?: string;
  uiTokenAmount: { amount: string; decimals: number };
};
export type PaymentChainEvidence = {
  finalized: boolean;
  rawBase64: string;
  err: unknown;
  accounts: { address: string; signer: boolean }[];
  instructions: { programId: string; parsed?: unknown }[];
  preBalances: HistoricalTokenBalance[];
  postBalances: HistoricalTokenBalance[];
  blockTime: number | null;
};
export type SettlementOutcome = {
  status: "paid" | "failed" | "needs_review";
  note: string;
};
export async function verifyPaymentSettlement(
  i: PaymentIntent,
  a: PaymentAttempt,
  tx: PaymentChainEvidence,
): Promise<SettlementOutcome> {
  const review = (note: string): SettlementOutcome => ({
    status: "needs_review",
    note,
  });
  if (
    !a.signature ||
    !a.signed_base64 ||
    !Buffer.from(tx.rawBase64, "base64").equals(
      Buffer.from(a.signed_base64, "base64"),
    )
  )
    return review(
      "Finalized transaction does not match the registered signed bytes.",
    );
  if (!tx.finalized)
    return review("Transaction is not finalized. Do not mark it paid.");
  if (tx.err === undefined)
    return review("Transaction success metadata is missing.");
  if (tx.err !== null)
    return {
      status: "failed",
      note: "Finalized transaction failed on devnet; no token settlement occurred.",
    };
  if (!tx.blockTime)
    return review("Finalized transaction timestamp is unavailable.");
  if (
    i.network !== "devnet" ||
    i.mint !== TEST_USDC_MINT ||
    i.token_program !== TOKEN_PROGRAM ||
    i.decimals !== 6
  )
    return review("Unsupported network or asset.");
  if (
    (await tokenAccount(i.payer_wallet)) !== i.source_account ||
    (await tokenAccount(i.recipient_wallet)) !== i.destination_account
  )
    return review("Wallet ownership and token destination do not match.");
  if (tx.accounts[0]?.address !== i.payer_wallet || !tx.accounts[0]?.signer)
    return review("The registered payer is not the fee payer and signer.");
  const transfers = tx.instructions.filter(
    (ins) => ins.programId === TOKEN_PROGRAM,
  );
  if (transfers.length !== 1) return review("Unexpected token instructions.");
  const parsed = transfers[0].parsed as {
    type?: string;
    info?: {
      source?: string;
      destination?: string;
      authority?: string;
      mint?: string;
      tokenAmount?: { amount?: string; decimals?: number };
    };
  };
  const info = parsed?.info;
  if (
    parsed?.type !== "transferChecked" ||
    info?.source !== i.source_account ||
    info.destination !== i.destination_account ||
    info.authority !== i.payer_wallet ||
    info.mint !== i.mint ||
    info.tokenAmount?.decimals !== 6
  )
    return review(
      "Transfer authority, token mint, decimals, or destination mismatch.",
    );
  if (info.tokenAmount.amount !== i.amount_units)
    return review(
      BigInt(info.tokenAmount.amount ?? "0") < BigInt(i.amount_units)
        ? "Underpaid transfer; manual review required."
        : "Overpaid transfer; manual review required.",
    );
  if (
    tx.instructions.length !== 3 ||
    tx.instructions[0].programId !== ASSOCIATED_TOKEN_PROGRAM ||
    tx.instructions[2].programId !== MEMO_PROGRAM ||
    tx.instructions[2].parsed !== (await paymentMemo(i))
  )
    return review("Payment memo or instruction layout mismatch.");
  const sourceIndex = tx.accounts.findIndex(
      (k) => k.address === i.source_account,
    ),
    destIndex = tx.accounts.findIndex(
      (k) => k.address === i.destination_account,
    );
  if (sourceIndex < 0 || destIndex < 0)
    return review("Expected token accounts are absent.");
  const preSource = tx.preBalances.find((b) => b.accountIndex === sourceIndex),
    postSource = tx.postBalances.find((b) => b.accountIndex === sourceIndex),
    preDest = tx.preBalances.find((b) => b.accountIndex === destIndex),
    postDest = tx.postBalances.find((b) => b.accountIndex === destIndex);
  function correct(b: HistoricalTokenBalance | undefined, owner: string) {
    return Boolean(
      b &&
      b.owner === owner &&
      b.mint === i.mint &&
      b.programId === TOKEN_PROGRAM &&
      b.uiTokenAmount.decimals === 6 &&
      /^\d+$/.test(b.uiTokenAmount.amount),
    );
  }
  if (
    !correct(preSource, i.payer_wallet) ||
    !correct(postSource, i.payer_wallet) ||
    !correct(postDest, i.recipient_wallet) ||
    (preDest && !correct(preDest, i.recipient_wallet))
  )
    return review(
      "Historical token ownership or mint metadata is missing or mismatched.",
    );
  if (
    BigInt(preSource!.uiTokenAmount.amount) -
      BigInt(postSource!.uiTokenAmount.amount) !==
      BigInt(i.amount_units) ||
    BigInt(postDest!.uiTokenAmount.amount) -
      BigInt(preDest?.uiTokenAmount.amount ?? "0") !==
      BigInt(i.amount_units)
  )
    return review(
      "Actual token balance changes do not equal the approved payment.",
    );
  const indices = new Set(
    [...tx.preBalances, ...tx.postBalances].map((b) => b.accountIndex),
  );
  for (const idx of indices) {
    if (idx === sourceIndex || idx === destIndex) continue;
    const pre =
        tx.preBalances.find((b) => b.accountIndex === idx)?.uiTokenAmount
          .amount ?? "0",
      post =
        tx.postBalances.find((b) => b.accountIndex === idx)?.uiTokenAmount
          .amount ?? "0";
    if (pre !== post) return review("Unexplained additional token movement.");
  }
  return {
    status: "paid",
    note: "Finalized devnet transfer matches the approved obligation, wallet owners, asset and exact amount.",
  };
}
