import test from "node:test";
import assert from "node:assert/strict";
import {
  organizationTrust,
  organizationVerificationInput,
} from "../src/lib/organization-trust";
test("registration, type, wallet or category permission does not infer institutional trust", () => {
  for (const o of [
    undefined,
    {},
    {
      trust_level: undefined,
      issuer_status: "authorized",
      allowed_credential_types: ["degree"],
      organization_type: "university",
      wallet: "owned",
    },
  ])
    assert.equal(organizationTrust(o).label, "Self-registered");
});
test("verified identity and reviewed assessment standards are distinct current labels", () => {
  assert.equal(
    organizationTrust({ trust_level: "verified_organization" }).label,
    "Verified Organization",
  );
  assert.match(
    organizationTrust({ trust_level: "verified_organization" }).detail,
    /not reviewed/,
  );
  assert.equal(
    organizationTrust({ trust_level: "trusted_assessment_partner" }).label,
    "Trusted Assessment Partner",
  );
  assert.equal(
    organizationTrust({
      trust_level: "trusted_assessment_partner",
      trust_suspended: true,
    }).label,
    "Self-registered",
  );
  assert.match(
    organizationTrust({ trust_suspended: true }).detail,
    /suspended/,
  );
});
test("verification inputs bound private evidence and refuse non-HTTPS or missing institutional information", () => {
  const v = {
    organization_id: "81000000-0000-4000-8000-000000000001",
    identity_statement: "Institutional identity and authority evidence.",
    representative_role: "Director",
    identity_evidence_url: "https://example.com/evidence",
    assessment_statement: "",
    assessment_evidence_url: "",
  };
  assert.ok(organizationVerificationInput.safeParse(v).success);
  for (const patch of [
    { identity_statement: "short" },
    { identity_evidence_url: "javascript:alert(1)" },
    { identity_evidence_url: "http://example.com" },
    { assessment_evidence_url: "file:///private" },
    { assessment_statement: "x".repeat(2001) },
  ])
    assert.equal(
      organizationVerificationInput.safeParse({ ...v, ...patch }).success,
      false,
    );
});
