"use client";
import { useState } from "react";
import { PassportSectionState } from "./passport-section-state";
import { OrganizationOnboarding } from "./organization-onboarding";
import type { Organization } from "@/lib/credentials";
export function Task21Fixture() {
  const [state, setState] = useState("unavailable");
  const o = {
    id: "org",
    company_id: "company",
    organization_type: state === "university" ? "university" : "training",
    issuer_status: state === "approved" ? "authorized" : "pending",
    allowed_credential_types: state === "approved" ? ["course"] : [],
    trust_level:
      state === "verified" ? "verified_organization" : "self_registered",
    companies: {
      name: "Fixture institution",
      description: "Offline illustration only",
      website: "",
    },
  } as Organization;
  return (
    <main className="container page">
      <h1>Offline Passport and organization fixture</h1>
      <label className="field">
        Fixture state
        <select value={state} onChange={(e) => setState(e.target.value)}>
          {[
            "unavailable",
            "empty",
            "loading",
            "university",
            "verified",
            "approved",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <section>
        <h2>Available project</h2>
        <p>This successfully loaded section remains visible.</p>
      </section>
      <PassportSectionState
        title="Credentials"
        state={
          ["empty", "loading"].includes(state)
            ? (state as "empty" | "loading")
            : "unavailable"
        }
      />
      <OrganizationOnboarding
        organization={o}
        canEdit={state !== "university"}
      />
    </main>
  );
}
