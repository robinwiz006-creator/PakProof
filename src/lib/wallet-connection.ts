import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";
import { REMOTE_WALLET } from "./wallet-session";
export { REMOTE_WALLET };
export async function signingWallet(
  name: string,
  feature: "solana:signMessage" | "solana:signTransaction",
): Promise<Wallet | undefined> {
  if (name === REMOTE_WALLET) {
    const { pairedWallet } = await import("./wallet-pairing");
    return pairedWallet();
  }
  return getWallets()
    .get()
    .find(
      (wallet) =>
        wallet.name === name &&
        "standard:connect" in wallet.features &&
        feature in wallet.features,
    );
}
