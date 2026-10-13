import { createAppKit } from "@reown/appkit";
import { solanaDevnet } from "@reown/appkit/networks";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import {
  sessionWallet,
  withWalletTimeout,
  type SigningSession,
} from "./wallet-session";
let modal: ReturnType<typeof createAppKit> | undefined;
function appKit() {
  if (modal) return modal;
  const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID;
  if (!projectId)
    throw new Error(
      "Mobile QR pairing needs a Reown project ID. Browser extensions still work. Ask the site administrator to configure pairing.",
    );
  modal = createAppKit({
    adapters: [new SolanaAdapter()],
    networks: [solanaDevnet],
    defaultNetwork: solanaDevnet,
    projectId,
    metadata: {
      name: "ProofPak",
      description: "Optional devnet wallet connection for ProofPak",
      url: window.location.origin,
      icons: [`${window.location.origin}/icon.svg`],
    },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#C6532C",
      "--w3m-color-mix": "#F5F0E6",
      "--w3m-color-mix-strength": 25,
      "--w3m-border-radius-master": "2px",
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
      send: false,
      receive: false,
      history: false,
    },
    enableWallets: true,
    enableNetworkSwitch: false,
  });
  return modal;
}
function readSession(): SigningSession {
  const kit = appKit();
  const account = kit.getAccount("solana");
  const provider = kit.getProvider<
    SigningSession & {
      session?: {
        namespaces?: { solana?: { methods?: string[]; accounts?: string[] } };
      };
    }
  >("solana");
  if (!account?.isConnected || !account.address || !provider)
    throw new Error(
      "No active mobile wallet session. Connect from Wallet first.",
    );
  if (
    typeof provider.signMessage !== "function" ||
    typeof provider.signTransaction !== "function"
  )
    throw new Error(
      "This connection cannot sign messages and transactions. Choose a compatible wallet.",
    );
  const namespace = provider.session?.namespaces?.solana;
  const chainAccounts = namespace?.accounts;
  const devnetAccounts = [
    `${solanaDevnet.caipNetworkId}:${account.address}`,
    `solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K:${account.address}`,
  ];
  if (
    provider.session &&
    (!chainAccounts?.some((a) => devnetAccounts.includes(a)) ||
      !namespace?.methods)
  )
    throw new Error(
      "The phone wallet did not authorize a devnet signing session. Choose devnet and reconnect.",
    );
  return {
    address: account.address,
    devnet: kit.getChainId() === solanaDevnet.id,
    methods: provider.session?.namespaces?.solana?.methods,
    signMessage: (message) => provider.signMessage(message),
    signTransaction: (transaction) => provider.signTransaction(transaction),
    disconnect: () => kit.disconnect("solana"),
  };
}
export async function pairedWallet() {
  const kit = appKit();
  await withWalletTimeout(kit.ready());
  return sessionWallet(readSession);
}
export async function connectPairedWallet() {
  const kit = appKit();
  await withWalletTimeout(kit.ready());
  // An existing session still needs a fresh server-issued ownership challenge.
  if (kit.getAccount("solana")?.isConnected) return sessionWallet(readSession);
  return new Promise<ReturnType<typeof sessionWallet>>((resolve, reject) => {
    let finished = false,
      opened = false;
    const cleanup: (() => void)[] = [];
    function finish(error?: Error) {
      if (finished) return;
      let wallet;
      try {
        if (!error) wallet = sessionWallet(readSession);
      } catch (e) {
        error =
          e instanceof Error ? e : new Error("Unsupported wallet session.");
      }
      finished = true;
      cleanup.forEach((off) => off());
      void kit.close();
      if (error) reject(error);
      else resolve(wallet!);
    }
    function check() {
      if (kit.getAccount("solana")?.isConnected && kit.getProvider("solana"))
        finish();
    }
    cleanup.push(
      kit.subscribeAccount(check, "solana"),
      kit.subscribeProviders(check),
    );
    cleanup.push(
      kit.subscribeState((state) => {
        if (state.open) opened = true;
        else if (opened && !finished) {
          if (kit.getAccount("solana")?.isConnected) check();
          else
            finish(
              new Error(
                "Wallet connection cancelled or rejected. Nothing was linked.",
              ),
            );
        }
      }),
    );
    const timeout = setTimeout(
      () =>
        finish(
          new Error(
            "Pairing timed out. Nothing was linked. Generate a new pairing and try again.",
          ),
        ),
      120_000,
    );
    cleanup.push(() => clearTimeout(timeout));
    void kit
      .open({ view: "Connect", namespace: "solana" })
      .catch((e) =>
        finish(
          e instanceof Error ? e : new Error("Could not open wallet pairing."),
        ),
      );
    check();
  });
}
export async function disconnectPairedWallet() {
  await appKit().disconnect("solana");
}
