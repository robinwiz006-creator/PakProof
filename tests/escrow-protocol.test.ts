import { test } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "buffer";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";
import {
  createEscrowInstruction,
  decodeEscrowState,
  encodeEscrowAction,
  escrowAddresses,
  escrowAmount,
  escrowTotals,
  type EscrowState,
} from "../src/lib/escrow-protocol";
import {
  verifyEscrowObservation,
  type EscrowObservation,
} from "../src/lib/escrow-observation";
import { DEVNET_GENESIS } from "../src/lib/proof";
import { TEST_USDC_MINT, TOKEN_PROGRAM } from "../src/lib/payments";
const key = (n: number) =>
  new PublicKey(Uint8Array.from({ length: 32 }, () => n)).toBase58();
const state: EscrowState = {
  payer: key(1),
  worker: key(2),
  resolver: null,
  agreement: "07".repeat(32),
  terms: "08".repeat(32),
  fullFunding: false,
  accepted: true,
  closed: false,
  milestones: [
    {
      amount: 200n,
      stage: "funded",
      evidence: "00".repeat(32),
      released: 0n,
      refunded: 0n,
    },
    {
      amount: 300n,
      stage: "unfunded",
      evidence: "00".repeat(32),
      released: 0n,
      refunded: 0n,
    },
  ],
};
function fixtureBytes(s: EscrowState) {
  const bytes = Buffer.alloc(2048);
  let o = 0;
  const put = (b: Uint8Array) => {
    bytes.set(b, o);
    o += b.length;
  };
  const u64 = (n: bigint) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(n);
    return b;
  };
  put(Buffer.from("PPESCR01"));
  put(new PublicKey(s.payer).toBytes());
  put(new PublicKey(s.worker).toBytes());
  put(Buffer.from([s.resolver ? 1 : 0]));
  if (s.resolver) put(new PublicKey(s.resolver).toBytes());
  put(Buffer.from(s.agreement, "hex"));
  put(Buffer.from(s.terms, "hex"));
  put(Buffer.from([+s.fullFunding, +s.accepted, +s.closed]));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(s.milestones.length);
  put(len);
  for (const m of s.milestones) {
    put(u64(m.amount));
    put(
      Buffer.from([
        [
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
        ].indexOf(m.stage),
      ]),
    );
    put(Buffer.from(m.evidence, "hex"));
    put(u64(m.released));
    put(u64(m.refunded));
  }
  return bytes;
}
test("escrow protocol keeps exact integer amounts and stable Rust/Borsh instruction tags", () => {
  assert.equal(escrowAmount("18446744073709551615"), (1n << 64n) - 1n);
  for (const v of ["1.2", "-1", "0", "01", "18446744073709551616"])
    assert.throws(() => escrowAmount(v));
  assert.equal(
    encodeEscrowAction({ type: "fund", index: 2 }).toString("hex"),
    "0202",
  );
  assert.equal(
    encodeEscrowAction({ type: "release", index: 2 }).toString("hex"),
    "0602",
  );
  assert.equal(
    encodeEscrowAction({
      type: "resolve",
      index: 2,
      workerAmount: 80n,
    }).toString("hex"),
    "09025000000000000000",
  );
  assert.throws(() => encodeEscrowAction({ type: "fund", index: 20 }));
});
test("creation binds immutable parties/amounts/terms and derives distinct program-controlled addresses", async () => {
  const args = {
    program: key(3),
    payer: state.payer,
    worker: state.worker,
    resolver: null,
    agreement: state.agreement,
    terms: state.terms,
    amounts: ["200", "300"],
    fullFunding: true,
  };
  const ix = await createEscrowInstruction(args);
  const addresses = await escrowAddresses(
    args.program,
    args.payer,
    args.agreement,
  );
  assert.equal(ix.keys[1].pubkey.toBase58(), addresses.state);
  assert.equal(ix.keys[2].pubkey.toBase58(), addresses.vault);
  assert.equal(ix.keys[3].pubkey.toBase58(), TEST_USDC_MINT);
  assert.equal(ix.data[0], 0);
  assert.equal(
    Buffer.from(ix.data).subarray(33, 65).toString("hex"),
    state.terms,
  );
  assert.notEqual(addresses.state, addresses.vault);
  await assert.rejects(
    createEscrowInstruction({
      ...args,
      amounts: ["18446744073709551615", "1"],
    }),
  );
  await assert.rejects(
    createEscrowInstruction({ ...args, worker: args.payer }),
  );
});
test("state accounting distinguishes funded/released/refunded/unfunded; cannot manufacture paid state", () => {
  assert.deepEqual(decodeEscrowState(fixtureBytes(state)), state);
  assert.deepEqual(escrowTotals(state), {
    total: 500n,
    funded: 200n,
    released: 0n,
    refunded: 0n,
    reserved: 200n,
    unfunded: 300n,
  });
  assert.throws(() => escrowTotals({ ...state, accepted: false }));
  assert.throws(() => escrowTotals({ ...state, fullFunding: true }));
  assert.throws(() =>
    escrowTotals({
      ...state,
      milestones: [{ ...state.milestones[0], stage: "paid" }],
    }),
  );
  assert.throws(() => decodeEscrowState(new Uint8Array(100)));
  const changed = fixtureBytes(state);
  changed[2047] = 1;
  assert.throws(() => decodeEscrowState(changed));
});
test("read-only observation rejects wrong chain, code, authorities, mint, PDA and insufficient vault backing", async () => {
  const addresses = await escrowAddresses(key(3), state.payer, state.agreement);
  const code = Buffer.from("EXPLICIT SYNTHETIC DEPLOYED-CODE FIXTURE");
  const expected = {
    program: key(3),
    ...state,
    amounts: ["200", "300"],
    programDataSha256: createHash("sha256").update(code).digest("hex"),
    upgradeAuthority: null,
  };
  const o: EscrowObservation = {
    genesis: DEVNET_GENESIS,
    finalized: true,
    slot: 1n,
    program: {
      address: key(3),
      executable: true,
      loader: "BPFLoaderUpgradeab1e11111111111111111111111",
      programData: code,
      upgradeAuthority: null,
    },
    account: {
      address: addresses.state,
      owner: key(3),
      data: fixtureBytes(state),
    },
    vault: {
      address: addresses.vault,
      program: TOKEN_PROGRAM,
      mint: TEST_USDC_MINT,
      authority: addresses.state,
      amount: 200n,
      initialized: true,
      delegate: null,
      closeAuthority: null,
    },
  };
  assert.equal(
    (await verifyEscrowObservation(expected, o)).totals.reserved,
    200n,
  );
  for (const changed of [
    { ...o, genesis: "mainnet" },
    { ...o, finalized: false },
    { ...o, account: { ...o.account, owner: key(4) } },
    { ...o, program: { ...o.program, programData: Buffer.from("OTHER CODE") } },
    { ...o, program: { ...o.program, upgradeAuthority: key(4) } },
    { ...o, vault: { ...o.vault, mint: key(4) } },
    { ...o, vault: { ...o.vault, amount: 199n } },
    { ...o, vault: { ...o.vault, authority: key(4) } },
    { ...o, vault: { ...o.vault, delegate: key(4) } },
  ])
    await assert.rejects(verifyEscrowObservation(expected, changed));
  // Unsolicited tokens never allocate an unfunded milestone.
  const extra = await verifyEscrowObservation(expected, {
    ...o,
    vault: { ...o.vault, amount: 250n },
  });
  assert.equal(extra.unallocatedTokens, 50n);
  assert.equal(extra.totals.unfunded, 300n);
});
