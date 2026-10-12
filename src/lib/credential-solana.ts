import "server-only";
import { connection, transactionStatus } from "./solana";
import { DEVNET_GENESIS } from "./proof";
import { matchesCredentialAnchor } from "./credential-proof";
export async function checkCredentialAnchor(
  signature: string,
  hash: string,
  wallet: string,
) {
  const rpc = connection();
  if ((await rpc.getGenesisHash()) !== DEVNET_GENESIS)
    throw new Error("RPC is not devnet");
  const tx = await rpc.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  return {
    valid: matchesCredentialAnchor(tx, hash, wallet),
    blockTime: tx?.blockTime ?? null,
    status: tx
      ? tx.meta?.err
        ? "failed"
        : "finalized"
      : await transactionStatus(signature),
  };
}
