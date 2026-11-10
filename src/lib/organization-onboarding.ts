import { organizationTrust } from "./organization-trust";
import type { Organization } from "./credentials";
export function organizationSetup(o: Organization) {
  const knownCategories = Array.isArray(o.allowed_credential_types);
  const canIssue =
    o.issuer_status === "authorized" &&
    (o.allowed_credential_types?.length ?? 0) > 0;
  const knownTrust = typeof o.trust_level === "string";
  const verified =
    knownTrust &&
    !o.trust_suspended &&
    ["verified_organization", "trusted_assessment_partner"].includes(
      o.trust_level!,
    );
  return {
    canIssue,
    verified,
    trustLabel: knownTrust
      ? organizationTrust(o).label
      : "Verification status unavailable",
    steps: [
      {
        title: "Organization registered",
        status: "Complete",
        description:
          "Your members can post opportunities and review work. Registration does not verify institutional identity.",
      },
      {
        title: "Institutional verification",
        status: verified
          ? organizationTrust(o).label
          : knownTrust
            ? o.trust_suspended
              ? "Verification suspended"
              : "Not confirmed"
            : "Unavailable",
        description:
          "ProofPak reviews institutional identity separately. Open verification below to submit evidence or check a request.",
      },
      {
        title: "Permission to issue credentials",
        status: canIssue
          ? "Categories approved"
          : o.issuer_status === "suspended"
            ? "Issuance suspended"
            : !knownCategories
              ? "Category status unavailable"
              : "Category approval required",
        description:
          "An independent administrator must approve the specific categories you may issue. Identity verification alone grants no categories.",
      },
    ],
  };
}
