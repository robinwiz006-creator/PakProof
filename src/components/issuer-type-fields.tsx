"use client";
import { useState } from "react";
import {
  permittedCredentialTypes,
  credentialTypeLabels,
} from "@/lib/issuer-permissions";
export function IssuerTypeFields({
  organizations,
}: {
  organizations: { id: string; name: string; types: string[] }[];
}) {
  const [selected, setSelected] = useState(organizations[0]?.id ?? "");
  const org = organizations.find((o) => o.id === selected);
  return (
    <>
      <label className="field">
        Issuing organization
        <select
          name="organization_id"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Credential type
        <select key={selected} name="credential_type" required>
          {permittedCredentialTypes(org?.types).map((t) => (
            <option key={t} value={t}>
              {credentialTypeLabels[t]}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        Only categories approved for this organization are available. Approval
        is not government accreditation.
      </p>
    </>
  );
}
