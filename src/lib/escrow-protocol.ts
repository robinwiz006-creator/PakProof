import { Buffer } from "buffer";
import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { TEST_USDC_MINT, TOKEN_PROGRAM } from "./payments";
export const ESCROW_STATE_SIZE = 2048;
export const escrowStages = [
  "unfunded",
  "funded",
  "active",
  "submitted",
  "revision",
  "approved",
  "disputed",
  "paid",
  "refunded",
  "resolved",
] as const;
export type EscrowStage = (typeof escrowStages)[number];
export type EscrowMilestone = {
  amount: bigint;
  stage: EscrowStage;
  evidence: string;
  released: bigint;
  refunded: bigint;
};
export type EscrowState = {
  payer: string;
  worker: string;
  resolver: string | null;
  agreement: string;
  terms: string;
  fullFunding: boolean;
  accepted: boolean;
  closed: boolean;
  milestones: EscrowMilestone[];
};
const MAX = (1n << 64n) - 1n;
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function escrowAmount(value: string) {
  check(
    /^[1-9][0-9]{0,19}$/.test(value),
    "Use positive integer token base units.",
  );
  const n = BigInt(value);
  check(n <= MAX, "Token amount exceeds u64.");
  return n;
}
function bytes32(hex: string) {
  check(
    /^[a-f0-9]{64}$/.test(hex),
    "Expected a 32-byte lowercase hexadecimal commitment.",
  );
  return Buffer.from(hex, "hex");
}
function u64(n: bigint) {
  check(n >= 0n && n <= MAX, "Invalid u64.");
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}
export async function escrowAddresses(
  program: string,
  payer: string,
  agreement: string,
) {
  const [state] = await PublicKey.findProgramAddress(
    [Buffer.from("escrow"), new PublicKey(payer).toBytes(), bytes32(agreement)],
    new PublicKey(program),
  );
  const [vault] = await PublicKey.findProgramAddress(
    [Buffer.from("vault"), state.toBytes()],
    new PublicKey(program),
  );
  return { state: state.toBase58(), vault: vault.toBase58() };
}
export type EscrowAction =
  | { type: "accept" | "close" }
  | { type: "fund" | "start" | "release" | "dispute" | "refund"; index: number }
  | { type: "submit"; index: number; evidence: string }
  | { type: "review"; index: number; approve: boolean }
  | { type: "resolve"; index: number; workerAmount: bigint };
export function encodeEscrowAction(a: EscrowAction) {
  const tags = {
    accept: 1,
    fund: 2,
    start: 3,
    submit: 4,
    review: 5,
    release: 6,
    dispute: 7,
    refund: 8,
    resolve: 9,
    close: 10,
  };
  if ("index" in a)
    check(
      Number.isInteger(a.index) && a.index >= 0 && a.index < 20,
      "Invalid milestone index.",
    );
  return Buffer.concat([
    Buffer.from([tags[a.type]]),
    "index" in a ? Buffer.from([a.index]) : Buffer.alloc(0),
    a.type === "submit"
      ? bytes32(a.evidence)
      : a.type === "review"
        ? Buffer.from([a.approve ? 1 : 0])
        : a.type === "resolve"
          ? u64(a.workerAmount)
          : Buffer.alloc(0),
  ]);
}
export async function createEscrowInstruction(input: {
  program: string;
  payer: string;
  worker: string;
  resolver: string | null;
  agreement: string;
  terms: string;
  amounts: string[];
  fullFunding: boolean;
}) {
  check(
    input.payer !== input.worker &&
      input.amounts.length > 0 &&
      input.amounts.length <= 20,
    "Choose distinct parties and 1–20 milestones.",
  );
  check(
    input.terms !== "0".repeat(64) && input.agreement !== "0".repeat(64),
    "Empty commitments are not allowed.",
  );
  const amounts = input.amounts.map(escrowAmount);
  check(
    amounts.reduce((sum, n) => sum + n, 0n) <= MAX,
    "Total token amount overflows u64.",
  );
  if (input.resolver)
    check(
      input.resolver !== input.payer && input.resolver !== input.worker,
      "Resolver must be an independent, explicitly agreed authority.",
    );
  const address = await escrowAddresses(
    input.program,
    input.payer,
    input.agreement,
  );
  const len = Buffer.alloc(4);
  len.writeUInt32LE(amounts.length);
  const data = Buffer.concat([
    Buffer.from([0]),
    bytes32(input.agreement),
    bytes32(input.terms),
    Buffer.from(new PublicKey(input.worker).toBytes()),
    Buffer.from([input.resolver ? 1 : 0]),
    input.resolver
      ? Buffer.from(new PublicKey(input.resolver).toBytes())
      : Buffer.alloc(0),
    len,
    ...amounts.map(u64),
    Buffer.from([input.fullFunding ? 1 : 0]),
  ]);
  return new TransactionInstruction({
    programId: new PublicKey(input.program),
    keys: [
      { pubkey: new PublicKey(input.payer), isSigner: true, isWritable: true },
      {
        pubkey: new PublicKey(address.state),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(address.vault),
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey(TEST_USDC_MINT),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey(TOKEN_PROGRAM),
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });
}
export async function escrowInstruction(input: {
  program: string;
  state: EscrowState;
  authority: string;
  action: EscrowAction;
  source?: string;
  workerToken?: string;
  payerToken?: string;
  mutual?: boolean;
}) {
  const { state, authority, action } = input;
  const address = await escrowAddresses(
    input.program,
    state.payer,
    state.agreement,
  );
  const keys = [
    { pubkey: new PublicKey(authority), isSigner: true, isWritable: true },
    { pubkey: new PublicKey(address.state), isSigner: false, isWritable: true },
  ];
  const key = (
    address: string | undefined,
    writable = true,
    signer = false,
  ) => {
    check(address, "Required account is missing.");
    return {
      pubkey: new PublicKey(address),
      isSigner: signer,
      isWritable: writable,
    };
  };
  if (action.type === "fund")
    keys.push(
      key(address.vault),
      key(input.source),
      key(TEST_USDC_MINT, false),
      key(TOKEN_PROGRAM, false),
    );
  if (["release", "refund", "resolve"].includes(action.type)) {
    if (
      action.type === "refund" ||
      (action.type === "resolve" &&
        (state.resolver === null || authority !== state.resolver))
    )
      keys.push(key(state.worker, false, true));
    keys.push(
      key(address.vault),
      key(input.workerToken),
      key(input.payerToken),
      key(TEST_USDC_MINT, false),
      key(TOKEN_PROGRAM, false),
    );
  }
  if (
    action.type === "close" &&
    state.milestones.some((m) => m.stage !== "unfunded")
  )
    keys.push(
      key(authority === state.payer ? state.worker : state.payer, false, true),
    );
  return new TransactionInstruction({
    programId: new PublicKey(input.program),
    keys,
    data: encodeEscrowAction(action),
  });
}
export function decodeEscrowState(data: Uint8Array): EscrowState {
  check(data.length === ESCROW_STATE_SIZE, "Unexpected escrow state size.");
  const b = Buffer.from(data);
  let offset = 0;
  const take = (n: number) => {
    check(offset + n <= b.length, "Truncated escrow state.");
    const v = b.subarray(offset, offset + n);
    offset += n;
    return v;
  };
  const key = () => new PublicKey(take(32)).toBase58();
  const flag = () => {
    const n = take(1)[0];
    check(n <= 1, "Invalid boolean.");
    return n === 1;
  };
  check(take(8).toString() === "PPESCR01", "Unrecognized escrow version.");
  const payer = key(),
    worker = key(),
    resolver = flag() ? key() : null,
    agreement = take(32).toString("hex"),
    terms = take(32).toString("hex"),
    fullFunding = flag(),
    accepted = flag(),
    closed = flag();
  const count = take(4).readUInt32LE();
  check(count > 0 && count <= 20, "Invalid milestone count.");
  const milestones: EscrowMilestone[] = [];
  for (let i = 0; i < count; i++) {
    const amount = take(8).readBigUInt64LE();
    const stage = escrowStages[take(1)[0]];
    check(stage, "Unknown milestone state.");
    milestones.push({
      amount,
      stage,
      evidence: take(32).toString("hex"),
      released: take(8).readBigUInt64LE(),
      refunded: take(8).readBigUInt64LE(),
    });
  }
  check(
    take(b.length - offset).every((n) => n === 0),
    "Unexpected trailing escrow data.",
  );
  const s = {
    payer,
    worker,
    resolver,
    agreement,
    terms,
    fullFunding,
    accepted,
    closed,
    milestones,
  };
  escrowTotals(s);
  return s;
}
export function escrowTotals(s: EscrowState) {
  let total = 0n,
    funded = 0n,
    released = 0n,
    refunded = 0n;
  let unfundedSeen = false;
  for (const m of s.milestones) {
    check(escrowStages.includes(m.stage), "Unknown milestone state.");
    if (m.stage === "unfunded") unfundedSeen = true;
    else if (!s.fullFunding)
      check(!unfundedSeen, "Nonsequential milestone funding.");
    check(m.amount > 0n && m.amount <= MAX, "Invalid milestone amount.");
    total += m.amount;
    check(total <= MAX, "Contract total overflows u64.");
    check(
      m.released >= 0n &&
        m.refunded >= 0n &&
        m.released + m.refunded <= m.amount,
      "Invalid settlement accounting.",
    );
    const terminal = ["paid", "refunded", "resolved"].includes(m.stage);
    check(
      terminal
        ? m.released + m.refunded === m.amount
        : m.released === 0n && m.refunded === 0n,
      "Settlement counters contradict milestone state.",
    );
    if (m.stage === "paid")
      check(m.released === m.amount, "Paid amount mismatch.");
    if (m.stage === "refunded")
      check(m.refunded === m.amount, "Refund amount mismatch.");
    if (m.stage !== "unfunded") funded += m.amount;
    released += m.released;
    refunded += m.refunded;
  }
  check(s.accepted || funded === 0n, "Funding before worker consent.");
  if (s.fullFunding && funded > 0n)
    check(funded === total, "Partial allocation in full-project mode.");
  return {
    total,
    funded,
    released,
    refunded,
    reserved: funded - released - refunded,
    unfunded: total - funded,
  };
}
