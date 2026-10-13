import { getBase58Encoder } from "@solana/kit";
import { Transaction } from "solana-web3-legacy";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import type {
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";

export const REMOTE_WALLET = "Mobile / QR";
export interface SigningSession {
  address: string;
  devnet: boolean;
  methods?: readonly string[];
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  disconnect(): Promise<void>;
}
export async function withWalletTimeout<T>(
  operation: Promise<T>,
  milliseconds = 120_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "Wallet approval timed out. Nothing was linked or broadcast. Try again.",
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
/** Adapt an authenticated relay session to the existing sign-only workflows.
 * This never grants database ownership and never broadcasts a transaction. */
export function sessionWallet(read: () => SigningSession): Wallet {
  const initial = read();
  if (!initial.devnet)
    throw new Error("The wallet session must support Solana devnet.");
  for (const method of ["solana_signMessage", "solana_signTransaction"])
    if (initial.methods && !initial.methods.includes(method))
      throw new Error(
        `This wallet session does not support ${method}. Use a compatible wallet or browser extension.`,
      );
  if (getBase58Encoder().encode(initial.address).length !== 32)
    throw new Error("Wallet returned an invalid Solana public key.");
  const account: WalletAccount = {
    address: initial.address,
    publicKey: new Uint8Array(getBase58Encoder().encode(initial.address)),
    chains: ["solana:devnet"],
    features: ["solana:signMessage", "solana:signTransaction"],
  };
  function current(selected: WalletAccount) {
    const session = read();
    if (
      !session.devnet ||
      session.address !== account.address ||
      selected.address !== account.address
    )
      throw new Error(
        "Wallet account or network changed. Reconnect the correct devnet wallet.",
      );
    return session;
  }
  const message: SolanaSignMessageFeature["solana:signMessage"] = {
    version: "1.0.0",
    signMessage: async (...inputs) =>
      Promise.all(
        inputs.map(async (input) => {
          const session = current(input.account);
          const signedMessage = new Uint8Array(input.message);
          const signature = await withWalletTimeout(
            session.signMessage(signedMessage),
          );
          current(input.account);
          if (signature.length !== 64)
            throw new Error("Wallet returned an invalid ownership signature.");
          return {
            signature,
            signedMessage,
            signatureType: "ed25519" as const,
          };
        }),
      ),
  };
  const transaction: SolanaSignTransactionFeature["solana:signTransaction"] = {
    version: "1.0.0",
    supportedTransactionVersions: ["legacy"],
    signTransaction: async (...inputs) => {
      const outputs = [];
      for (const input of inputs) {
        if (input.chain !== "solana:devnet")
          throw new Error("Only Solana devnet signing is allowed.");
        const session = current(input.account);
        const original = Transaction.from(input.transaction);
        const originalMessage = original.serializeMessage();
        const signed = await withWalletTimeout(
          session.signTransaction(original),
        );
        current(input.account);
        if (!originalMessage.equals(signed.serializeMessage()))
          throw new Error(
            "Wallet changed the transaction. Nothing was broadcast.",
          );
        outputs.push({ signedTransaction: new Uint8Array(signed.serialize()) });
      }
      return outputs;
    },
  };
  return {
    version: "1.0.0",
    name: REMOTE_WALLET,
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
    chains: ["solana:devnet"],
    accounts: [account],
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => {
          current(account);
          return { accounts: [account] };
        },
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => read().disconnect(),
      },
      "solana:signMessage": message,
      "solana:signTransaction": transaction,
    },
  };
}
