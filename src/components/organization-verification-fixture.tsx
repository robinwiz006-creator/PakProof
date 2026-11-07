"use client";
import { useState } from "react";
import {
  OrganizationTrust,
  VerificationRequestForm,
  OrganizationTrustReviewForm,
} from "./organization-trust";
export function OrganizationVerificationFixture() {
  const [level, setLevel] = useState("self_registered");
  const [suspended, setSuspended] = useState(false);
  const [saved, setSaved] = useState("");
  return (
    <main className="container page narrow">
      <h1>Institutional trust fixture</h1>
      <p className="notice">
        Offline illustration only. No institutional verification, evidence
        submission or administrator approval is performed.
      </p>
      <label className="field">
        Fixture trust level
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="self_registered">Self-registered</option>
          <option value="verified_organization">Verified Organization</option>
          <option value="trusted_assessment_partner">
            Trusted Assessment Partner
          </option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={suspended}
          onChange={(e) => setSuspended(e.target.checked)}
        />{" "}
        Fixture suspension
      </label>
      <OrganizationTrust
        organization={{ trust_level: level, trust_suspended: suspended }}
      />
      <VerificationRequestForm
        id="81000000-0000-4000-8000-000000000001"
        action={async () =>
          setSaved("Offline submission captured; no trust was granted.")
        }
      />
      <h2 className="section-spacer">Independent administrator review</h2>
      <OrganizationTrustReviewForm
        id="81000000-0000-4000-8000-000000000001"
        requestId="81000000-0000-4000-8000-000000000002"
        expectedReview={null}
        action={async (f) =>
          setSaved(
            `Offline decision captured: ${f.get("decision")}. No real trust changed.`,
          )
        }
      />
      {saved && <p role="status">{saved}</p>}
    </main>
  );
}
