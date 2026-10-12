export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export type LegacyRecord = {
  version: 1;
  achievement_id: string;
  challenge_id: string;
  company_id: string;
  issued_at: string;
};
export type ClaimV2 = {
  version: 2;
  achievement_id: string;
  recipient_id: string;
  issuer_id: string;
  issuer_name: string;
  title: string;
  type: "company_challenge";
  challenge_id: string;
  submission_id: string;
  evidence_digest: string;
  issued_at: string;
};
export type AchievementRecord = LegacyRecord | ClaimV2;
export function claimV2(
  a: {
    id: string;
    talent_id: string;
    company_id: string;
    title: string;
    challenge_id: string;
    submission_id: string;
    issued_at: string;
  },
  snapshot: { issuer_name: string; evidence_digest: string },
): ClaimV2 {
  if (!/^[a-f0-9]{64}$/.test(snapshot.evidence_digest))
    throw new Error("Invalid evidence digest");
  return {
    version: 2,
    achievement_id: a.id,
    recipient_id: a.talent_id,
    issuer_id: a.company_id,
    issuer_name: snapshot.issuer_name,
    title: a.title,
    type: "company_challenge",
    challenge_id: a.challenge_id,
    submission_id: a.submission_id,
    evidence_digest: snapshot.evidence_digest,
    issued_at: new Date(a.issued_at).toISOString(),
  };
}
export function canonicalRecord(a: {
  id: string;
  challenge_id: string;
  company_id: string;
  issued_at: string;
}): LegacyRecord {
  return {
    version: 1,
    achievement_id: a.id,
    challenge_id: a.challenge_id,
    company_id: a.company_id,
    issued_at: new Date(a.issued_at).toISOString(),
  };
}
export function serializeRecord(r: AchievementRecord): string {
  if (r.version === 2)
    return JSON.stringify({
      version: 2,
      achievement_id: r.achievement_id,
      recipient_id: r.recipient_id,
      issuer_id: r.issuer_id,
      issuer_name: r.issuer_name,
      title: r.title,
      type: r.type,
      challenge_id: r.challenge_id,
      submission_id: r.submission_id,
      evidence_digest: r.evidence_digest,
      issued_at: r.issued_at,
    });
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
export function memoFor(hash: string, version: 1 | 2 = 1) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid achievement hash");
  return `proofpak:v${version}:${hash}`;
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
  version: 1 | 2 = 1,
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
        i.programId.toBase58() === MEMO_PROGRAM &&
        i.parsed === memoFor(hash, version),
    ),
  );
}
export function explorerLink(signature: string) {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`;
}
export type EvidenceSnapshot = {
  digest_salt: string;
  challenge_title: string;
  challenge_description: string;
  deliverables: string;
  project_url: string;
  github_url: string;
  explanation: string;
};
export async function evidenceDigest(e: EvidenceSnapshot) {
  // Matches PostgreSQL jsonb_build_array(... )::text for this fixed array of strings.
  const encoded = `[${[e.digest_salt, e.challenge_title, e.challenge_description, e.deliverables, e.project_url, e.github_url, e.explanation].map((v) => JSON.stringify(v)).join(", ")}]`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(encoded),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
