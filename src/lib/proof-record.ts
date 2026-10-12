import type { Achievement } from "./types";
import { canonicalRecord, claimV2 } from "./proof";
export function achievementRecord(a: Achievement, version: 1 | 2) {
  if (version === 1) return canonicalRecord(a);
  if (!a.achievement_claims)
    throw new Error("Approved claim snapshot is unavailable.");
  return claimV2(a, a.achievement_claims);
}

export function canRecoverLegacy(
  eligible: boolean,
  cutover: string,
  blockTime: number,
): boolean {
  return (
    eligible &&
    Number.isFinite(Date.parse(cutover)) &&
    blockTime <= Math.floor(Date.parse(cutover) / 1000)
  );
}
