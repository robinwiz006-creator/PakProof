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
) {
  const rpc = connection();
  if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
    throw new Error("RPC is not Solana devnet.");
  const tx = await rpc.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  return {
    valid: matchesAnchor(tx, hash, wallet),
    blockTime: tx?.blockTime ?? null,
  };
}
