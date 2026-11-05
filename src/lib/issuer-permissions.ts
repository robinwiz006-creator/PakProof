import { credentialTypes, type Credential } from "./credentials";
export const credentialTypeLabels: Record<string, string> = {
  degree: "Academic qualification (degree)",
  course: "Course completion",
  workshop: "Workshop participation",
  bootcamp: "Bootcamp completion",
  hackathon_participation: "Hackathon participation",
  hackathon_achievement: "Hackathon award",
  certification: "Professional certification / skill assessment",
  company_achievement: "Company achievement",
};
export function permittedCredentialTypes(types: readonly string[] = []) {
  return credentialTypes.filter((type) => types.includes(type));
}
export function issuanceProvenance(c: Credential) {
  const value = c.credential_issuance_provenance;
  return Array.isArray(value) ? value[0] : value;
}
export function issuanceTrustLabel(c: Credential) {
  return issuanceProvenance(c)?.representative_recorded
    ? "Category approved at issuance"
    : "Historical organization approval; category review not recorded";
}
