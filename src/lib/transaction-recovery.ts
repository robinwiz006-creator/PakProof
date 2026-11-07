import { MEMO_PROGRAM, memoFor } from "./proof";
import { credentialMemo } from "./credential-proof";
import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { getBase58Decoder } from "@solana/kit";

export type RecoveryStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;
export function notifyRecovery() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("proofpak-pending"));
    window.dispatchEvent(new Event("proofpak-recovery"));
  }
}
export function recoverySnapshot(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return "storage-unavailable";
  }
}
export function walletRejected(error: unknown): boolean {
  let value = error;
  for (let i = 0; i < 4 && value && typeof value === "object"; i++) {
    const e = value as { code?: unknown; cause?: unknown; error?: unknown };
    if (e.code === 4001 || e.code === "ACTION_REJECTED") return true;
    value = e.cause ?? e.error;
  }
  return false;
}
export function signatureStatus(
  s: { err: unknown; confirmationStatus?: string | null } | null | undefined,
) {
  if (!s) return "not_found";
  if (s.confirmationStatus !== "finalized") return "pending";
  return s.err ? "failed" : "finalized";
}
export type SavedProof = {
  schema: 1;
  attemptId: string;
  stage: "awaiting_signature" | "signed" | "submitted";
  wallet: string;
  claimVersion: 1 | 2 | 3;
  hash: string;
  blockhash: string;
  lastValidBlockHeight: string;
  signature?: string;
  signedBase64?: string;
};
export async function captureProof(
  storage: RecoveryStorage,
  key: string,
  input: Omit<
    SavedProof,
    "schema" | "attemptId" | "stage" | "signature" | "signedBase64"
  >,
  template: Uint8Array,
  sign: () => Promise<Uint8Array>,
): Promise<SavedProof & { signature: string; signedBase64: string }> {
  if (storage.getItem(key))
    throw new Error(
      "An existing proof attempt needs recovery. Do not sign another transaction.",
    );
  const pending: SavedProof = {
    ...input,
    schema: 1,
    attemptId: crypto.randomUUID(),
    stage: "awaiting_signature",
  };
  storage.setItem(key, JSON.stringify(pending));
  notifyRecovery();
  let bytes: Uint8Array;
  try {
    bytes = await sign();
  } catch (e) {
    if (walletRejected(e) && storage.getItem(key) === JSON.stringify(pending)) {
      storage.removeItem(key);
      notifyRecovery();
    }
    throw e;
  }
  if (!bytes.length || bytes.length > 1232)
    throw new Error("Invalid signed transaction size. Nothing sent.");
  const signed = Transaction.from(bytes),
    original = Transaction.from(template);
  if (
    !signed.signature ||
    signed.feePayer?.toBase58() !== input.wallet ||
    !Buffer.from(await signed.serializeMessage()).equals(
      Buffer.from(await original.serializeMessage()),
    ) ||
    !(await signed.verifySignatures())
  )
    throw new Error(
      "Wallet returned changed or invalid signed bytes. Recovery required; nothing broadcast by ProofPak.",
    );
  if (storage.getItem(key) !== JSON.stringify(pending))
    throw new Error(
      "Signing reservation changed. Existing recovery state was preserved; nothing broadcast.",
    );
  const record = {
    ...pending,
    stage: "signed" as const,
    signature: getBase58Decoder().decode(signed.signature),
    signedBase64: Buffer.from(bytes).toString("base64"),
  };
  storage.setItem(key, JSON.stringify(record));
  notifyRecovery();
  return record;
}
export function clearSavedProof(
  storage: RecoveryStorage,
  key: string,
  signature: string,
) {
  let record;
  try {
    const raw = storage.getItem(key);
    if (!raw) return false;
    record = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!record || record.signature !== signature) return false;
  try {
    storage.removeItem(key);
    notifyRecovery();
    return true;
  } catch {
    return false;
  }
}
export async function broadcastSavedProof(
  storage: RecoveryStorage,
  key: string,
  rpc: {
    sendRawTransaction: (
      bytes: Uint8Array,
      options: { skipPreflight: boolean; maxRetries: bigint },
    ) => Promise<string>;
  },
) {
  const record = JSON.parse(
    storage.getItem(key) ?? "null",
  ) as SavedProof | null;
  if (!record?.signature || !record.signedBase64)
    throw new Error(
      "Original signed bytes unavailable. Check or save the existing signature instead.",
    );
  const bytes = Buffer.from(record.signedBase64, "base64");
  const signed = Transaction.from(bytes);
  if (
    ![1, 2, 3].includes(record.claimVersion) ||
    signed.feePayer?.toBase58() !== record.wallet ||
    signed.recentBlockhash !== record.blockhash ||
    signed.instructions.length !== 1 ||
    signed.instructions[0].programId.toBase58() !== MEMO_PROGRAM ||
    Buffer.from(signed.instructions[0].data).toString("utf8") !==
      (record.claimVersion === 3
        ? credentialMemo(record.hash)
        : memoFor(record.hash, record.claimVersion)) ||
    !signed.signature ||
    getBase58Decoder().decode(signed.signature) !== record.signature ||
    !(await signed.verifySignatures())
  )
    throw new Error("Saved transaction signature mismatch. Nothing sent.");
  const returned = await rpc.sendRawTransaction(bytes, {
    skipPreflight: false,
    maxRetries: 3n,
  });
  if (returned !== record.signature)
    throw new Error(
      "Acknowledgement mismatch. Outcome unknown; keep the original signature.",
    );
  storage.setItem(key, JSON.stringify({ ...record, stage: "submitted" }));
  notifyRecovery();
  return record.signature;
}

export type PaymentContext = {
  schema: 1;
  attemptId: string;
  intentId: string;
  milestoneId: string;
  recipient: string;
  mint: string;
  amount: string;
  stage: "unsigned" | "awaiting_signature" | "signed";
};
export const paymentContextKey = (attemptId: string) =>
  `proofpak:payment-context:${attemptId}`;
function keys(storage: RecoveryStorage) {
  return Array.from({ length: storage.length }, (_, i) =>
    storage.key(i),
  ).filter((k): k is string => Boolean(k));
}
export function paymentBlocked(storage: RecoveryStorage, milestoneId: string) {
  if (storage.getItem(`proofpak:milestone-signed:${milestoneId}`)) return true;
  return keys(storage)
    .filter((k) => k.startsWith("proofpak:payment-context:"))
    .some((k) => {
      const c = JSON.parse(
        storage.getItem(k) ?? "null",
      ) as PaymentContext | null;
      return c?.milestoneId === milestoneId && c.stage !== "unsigned";
    });
}
export function preparePaymentContext(
  storage: RecoveryStorage,
  context: PaymentContext,
) {
  if (
    context.stage !== "unsigned" ||
    paymentBlocked(storage, context.milestoneId)
  )
    throw new Error(
      "A signed or interrupted signing attempt requires recovery first.",
    );
  const old = storage.getItem(paymentContextKey(context.attemptId));
  if (old && JSON.parse(old).stage !== "unsigned")
    throw new Error("Original signed context must be preserved.");
  storage.setItem(
    paymentContextKey(context.attemptId),
    JSON.stringify(context),
  );
  notifyRecovery();
}
export function paymentSigning(storage: RecoveryStorage, attemptId: string) {
  const key = paymentContextKey(attemptId),
    c = JSON.parse(storage.getItem(key) ?? "null") as PaymentContext | null;
  if (!c || c.stage !== "unsigned" || paymentBlocked(storage, c.milestoneId))
    throw new Error("Review the original payment preparation before signing.");
  storage.setItem(key, JSON.stringify({ ...c, stage: "awaiting_signature" }));
  storage.setItem(`proofpak:milestone-signed:${c.milestoneId}`, attemptId);
  notifyRecovery();
}
export function paymentRejection(
  storage: RecoveryStorage,
  attemptId: string,
  error: unknown,
) {
  if (!walletRejected(error)) return false;
  const key = paymentContextKey(attemptId),
    c = JSON.parse(storage.getItem(key) ?? "null") as PaymentContext | null;
  if (
    !c ||
    c.stage !== "awaiting_signature" ||
    storage.getItem(`proofpak:payment:${attemptId}`)
  )
    return false;
  storage.setItem(key, JSON.stringify({ ...c, stage: "unsigned" }));
  if (
    storage.getItem(`proofpak:milestone-signed:${c.milestoneId}`) === attemptId
  )
    storage.removeItem(`proofpak:milestone-signed:${c.milestoneId}`);
  notifyRecovery();
  return true;
}
export function saveSignedPayment(
  storage: RecoveryStorage,
  attemptId: string,
  signature: string,
  signed_base64: string,
) {
  const key = paymentContextKey(attemptId),
    c = JSON.parse(storage.getItem(key) ?? "null") as PaymentContext | null;
  if (!c || c.stage !== "awaiting_signature")
    throw new Error("Signing context is unavailable. Do not broadcast.");
  storage.setItem(
    `proofpak:payment:${attemptId}`,
    JSON.stringify({ signature, signed_base64 }),
  );
  storage.setItem(key, JSON.stringify({ ...c, stage: "signed" }));
  notifyRecovery();
}
// A server cancellation alone is not proof that the browser never signed.
export function clearUnsignedPayment(
  storage: RecoveryStorage,
  server: {
    id: string;
    intent_id: string;
    status: string;
    signature: string | null;
  },
) {
  if (server.status !== "cancelled" || server.signature) return false;
  const key = paymentContextKey(server.id),
    raw = storage.getItem(key);
  if (!raw || storage.getItem(`proofpak:payment:${server.id}`)) return false;
  const c = JSON.parse(raw) as PaymentContext;
  if (
    c.stage !== "unsigned" ||
    c.attemptId !== server.id ||
    c.intentId !== server.intent_id
  )
    return false;
  storage.removeItem(key);
  if (
    storage.getItem(`proofpak:milestone-signed:${c.milestoneId}`) === server.id
  )
    storage.removeItem(`proofpak:milestone-signed:${c.milestoneId}`);
  notifyRecovery();
  return true;
}
export function clearSettledPayment(
  storage: RecoveryStorage,
  server: { id: string; signature: string | null; status: string },
) {
  if (!["paid", "failed"].includes(server.status) || !server.signature)
    return false;
  const raw = storage.getItem(`proofpak:payment:${server.id}`);
  if (raw && JSON.parse(raw).signature !== server.signature) return false;
  storage.removeItem(`proofpak:payment:${server.id}`);
  storage.removeItem(paymentContextKey(server.id));
  for (const key of keys(storage))
    if (
      key.startsWith("proofpak:milestone-signed:") &&
      storage.getItem(key) === server.id
    )
      storage.removeItem(key);
  notifyRecovery();
  return true;
}
export function paymentLocalRisk(storage: RecoveryStorage, attemptId: string) {
  if (storage.getItem(`proofpak:payment:${attemptId}`)) return true;
  const raw = storage.getItem(paymentContextKey(attemptId));
  if (raw && JSON.parse(raw).stage !== "unsigned") return true;
  return keys(storage).some(
    (key) =>
      key.startsWith("proofpak:milestone-signed:") &&
      storage.getItem(key) === attemptId,
  );
}
