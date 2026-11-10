import { createHash } from "node:crypto";
import {
  decodeEscrowState,
  escrowAddresses,
  escrowTotals,
  type EscrowState,
} from "./escrow-protocol";
import { DEVNET_GENESIS } from "./proof";
import { TEST_USDC_MINT, TOKEN_PROGRAM } from "./payments";
export type EscrowCommitment = Pick<
  EscrowState,
  "payer" | "worker" | "resolver" | "agreement" | "terms" | "fullFunding"
> & {
  program: string;
  amounts: string[];
  programDataSha256: string;
  upgradeAuthority: string | null;
};
export type EscrowObservation = {
  genesis: string;
  finalized: boolean;
  slot: bigint;
  program: {
    address: string;
    executable: boolean;
    loader: string;
    programData: Uint8Array;
    upgradeAuthority: string | null;
  };
  account: { address: string; owner: string; data: Uint8Array };
  vault: {
    address: string;
    program: string;
    mint: string;
    authority: string;
    amount: bigint;
    initialized: boolean;
    delegate: string | null;
    closeAuthority: string | null;
  };
};
/** Read-only evidence validation. This does NOT credit a payment or prove a transaction receipt. */
export async function verifyEscrowObservation(
  expected: EscrowCommitment,
  o: EscrowObservation,
) {
  const fail = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message);
  };
  fail(
    o.genesis === DEVNET_GENESIS && o.finalized && o.slot >= 0n,
    "Finalized Solana devnet evidence is required.",
  );
  fail(
    /^[a-f0-9]{64}$/.test(expected.programDataSha256),
    "A reviewed deployed-code commitment is required.",
  );
  fail(
    expected.upgradeAuthority === null,
    "Funded escrow requires an immutable reviewed program; upgradeable deployments are disabled.",
  );
  fail(
    o.program.address === expected.program &&
      o.program.executable &&
      o.program.loader === "BPFLoaderUpgradeab1e11111111111111111111111",
    "Unrecognized executable program or loader.",
  );
  fail(
    createHash("sha256").update(o.program.programData).digest("hex") ===
      expected.programDataSha256 &&
      o.program.upgradeAuthority === expected.upgradeAuthority,
    "Deployed program or upgrade authority changed.",
  );
  const addresses = await escrowAddresses(
    expected.program,
    expected.payer,
    expected.agreement,
  );
  fail(
    o.account.address === addresses.state &&
      o.account.owner === expected.program,
    "Escrow account owner/PDA mismatch.",
  );
  const state = decodeEscrowState(o.account.data);
  for (const field of [
    "payer",
    "worker",
    "resolver",
    "agreement",
    "terms",
    "fullFunding",
  ] as const)
    fail(state[field] === expected[field], `Agreement ${field} mismatch.`);
  fail(
    state.milestones.length === expected.amounts.length &&
      state.milestones.every(
        (m, i) => m.amount.toString() === expected.amounts[i],
      ),
    "Milestone allocation mismatch.",
  );
  fail(
    o.vault.address === addresses.vault &&
      o.vault.program === TOKEN_PROGRAM &&
      o.vault.mint === TEST_USDC_MINT &&
      o.vault.authority === addresses.state &&
      o.vault.initialized &&
      o.vault.delegate === null &&
      o.vault.closeAuthority === null,
    "Escrow vault ownership/mint/state mismatch.",
  );
  const totals = escrowTotals(state);
  fail(o.vault.amount >= totals.reserved, "Vault is undercollateralized.");
  return {
    state,
    totals,
    slot: o.slot,
    unallocatedTokens: o.vault.amount - totals.reserved,
  };
}
