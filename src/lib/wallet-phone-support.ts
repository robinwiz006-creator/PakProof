export type SelectedWallet = "Phantom" | "Solflare";
/** Checked against official provider documentation and Reown's live registry.
 * A chain listing is not WalletConnect protocol support. */
export function phoneConnectionInfo(wallet: SelectedWallet) {
  if (wallet === "Phantom")
    return {
      title: "Phantom phone QR is unavailable",
      message:
        "Phantom does not support the WalletConnect pairing used by this integration. Its documented mobile deep links are a different flow; a generic WalletConnect QR would not be a Phantom-compatible connection.",
      alternative:
        "Use your Phantom browser extension on this computer. No download or wallet search is required here.",
    };
  return {
    title: "Solflare native phone pairing needs verification",
    message:
      "Solflare does not support this WalletConnect pairing either. Its own SDK offers a separate native connection service, but direct mobile QR, devnet and signing have not yet been verified together. We will not show an incompatible QR.",
    alternative:
      "Use your Solflare browser extension while its official native phone flow is checked.",
  };
}
/** Fail closed until a selected wallet's native protocol has been verified. */
export function requirePhonePairingSupport(wallet: SelectedWallet): never {
  throw new Error(phoneConnectionInfo(wallet).message);
}
