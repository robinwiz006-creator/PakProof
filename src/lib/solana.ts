import "server-only";
import { Connection } from "@solana/web3.js";
import { DEVNET_GENESIS, matchesAnchor } from "./proof";
export function connection() {
  return new Connection(
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "finalized",
  );
}
export async function checkAnchor(
  signature: string,
  hash: string,
  wallet: string,
  version: 1 | 2 = 1,
) {
  const rpc = connection();
  if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
    throw new Error("RPC is not Solana devnet.");
  const tx = await rpc.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  return {
    valid: matchesAnchor(tx, hash, wallet, version),
    blockTime: tx?.blockTime ?? null,
    status: tx
      ? tx.meta?.err
        ? "failed"
        : "finalized"
      : await transactionStatus(signature),
  };
}

export async function transactionStatus(signature: string) {
  const rpc = connection();
  if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
    throw new Error("RPC is not devnet");
  const { value } = await rpc.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const s = value[0];
  return !s
    ? "not_found"
    : s.err
      ? "failed"
      : s.confirmationStatus === "finalized"
        ? "finalized"
        : "pending";
}
