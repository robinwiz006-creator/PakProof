export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export type AchievementRecord = {
  version: 1;
  achievement_id: string;
  challenge_id: string;
  company_id: string;
  issued_at: string;
};
export function canonicalRecord(a: {
  id: string;
  challenge_id: string;
  company_id: string;
  issued_at: string;
}): AchievementRecord {
  return {
    version: 1,
    achievement_id: a.id,
    challenge_id: a.challenge_id,
    company_id: a.company_id,
    issued_at: new Date(a.issued_at).toISOString(),
  };
}
export function serializeRecord(r: AchievementRecord): string {
  return JSON.stringify({
    version: r.version,
    achievement_id: r.achievement_id,
    challenge_id: r.challenge_id,
    company_id: r.company_id,
    issued_at: r.issued_at,
  });
}
export async function hashRecord(r: AchievementRecord): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serializeRecord(r)),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function memoFor(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid achievement hash");
  return `proofpak:v1:${hash}`;
}
export type ChainEvidence = {
  meta: { err: unknown } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: { toBase58(): string }; signer: boolean }[];
      instructions: { programId: { toBase58(): string }; parsed?: unknown }[];
    };
  };
};
export function matchesAnchor(
  tx: ChainEvidence | null,
  hash: string,
  wallet: string,
): boolean {
  return Boolean(
    tx &&
    tx.meta &&
    tx.meta.err === null &&
    tx.transaction.message.accountKeys.some(
      (k) => k.signer && k.pubkey.toBase58() === wallet,
    ) &&
    tx.transaction.message.instructions.some(
      (i) =>
        i.programId.toBase58() === MEMO_PROGRAM && i.parsed === memoFor(hash),
    ),
  );
}
export function explorerLink(signature: string) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}
