"use client";
import { useState } from "react";
import type { Credential } from "@/lib/credentials";
import { CredentialDetail } from "./credential-detail";
import type { ProofState } from "@/lib/proof-status";
export function CredentialDetailFixture() {
  const [acceptance, setAcceptance] = useState<
    "accepted" | "pending" | "declined"
  >("accepted");
  const [published, setPublished] = useState(true);
  const [recorded, setRecorded] = useState(false);
  const [profilePublic, setProfilePublic] = useState(true);
  const [validity, setValidity] = useState("current");
  const [state, setState] = useState<ProofState>("pending");
  const [issuer, setIssuer] = useState<"authorized" | "pending" | "suspended">(
    "authorized",
  );
  const sample: Credential = {
    id: "70000000-0000-4000-8000-000000000001",
    organization_id: "70000000-0000-4000-8000-000000000002",
    authorization_id: "70000000-0000-4000-8000-000000000003",
    recipient_id: "70000000-0000-4000-8000-000000000004",
    issuer_name: "Illustrative Learning Organization",
    title: "Frontend Development Completion",
    credential_type: "course",
    description:
      "Completed a practical interface project and presented the design decisions and working implementation. This is an offline presentation fixture, not a real award.",
    issue_date: "2025-01-15",
    expiry_date: validity === "expired" ? "2025-06-01" : null,
    program_name: "Illustrative frontend programme",
    award: "",
    evidence_digest: "a".repeat(64),
    created_at: "2025-01-15T00:00:00Z",
    credential_preferences: {
      acceptance,
      is_public: published,
      share_evidence: false,
    },
    organizations: {
      id: "fixture",
      company_id: "fixture",
      organization_type: "training",
      issuer_status: issuer,
      authorization_id: "fixture",
      companies: {
        name: "Illustrative Learning Organization",
        description: "Presentation fixture only",
        website: "https://example.com",
      },
    },
    credential_events:
      validity === "revoked"
        ? [
            {
              event_type: "revoked",
              reason:
                "Offline fixture: the issuer withdrew this example record.",
              created_at: "2025-02-01T00:00:00Z",
            },
          ]
        : [],
    // Deliberately provided to verify the presentation never leaks non-shared evidence.
    credential_evidence: {
      evidence_url: "https://example.com/private-fixture-evidence",
      digest_salt: "private-fixture-salt",
    },
    credential_proofs:
      state === "pending" && !recorded
        ? []
        : [
            {
              signature: "offline-transaction-fixture",
              record_hash: "a".repeat(64),
              issuer_wallet: "offline-wallet-fixture",
              anchored_at: "2025-01-15T00:00:00Z",
            },
          ],
  };
  return (
    <section
      className="container page credential-page"
      aria-label="Credential presentation fixture"
    >
      <p className="notice">
        Offline credential presentation fixture. Status controls are for tests
        only. No real credential or finalized transaction is claimed.
      </p>
      <div className="grid-2">
        <label className="field">
          Fixture recipient decision
          <select
            aria-label="Fixture recipient decision"
            value={acceptance}
            onChange={(e) => setAcceptance(e.target.value as typeof acceptance)}
          >
            <option value="accepted">Accepted</option>
            <option value="pending">Pending</option>
            <option value="declined">Declined</option>
          </select>
        </label>
        <label className="field">
          Fixture validity
          <select
            aria-label="Fixture validity"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
          >
            <option value="current">Current</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        <label className="field">
          Fixture integrity
          <select
            aria-label="Fixture integrity"
            value={state}
            onChange={(e) => setState(e.target.value as ProofState)}
          >
            {[
              "pending",
              "verified",
              "failed",
              "unavailable",
              "mismatch",
              "missing",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Fixture organization approval
          <select
            aria-label="Fixture organization approval"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value as typeof issuer)}
          >
            <option value="authorized">Approved</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </div>
      <label>
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />{" "}
        Fixture credential public
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={profilePublic}
          onChange={(e) => setProfilePublic(e.target.checked)}
        />{" "}
        Fixture passport public
      </label>
      <br />
      <label>
        <input
          type="checkbox"
          checked={recorded}
          onChange={(e) => setRecorded(e.target.checked)}
        />{" "}
        Fixture transaction recorded
      </label>
      <CredentialDetail
        credential={sample}
        recipient={{
          full_name: "Illustrative Recipient",
          slug: "illustrative-recipient",
          is_public: profilePublic,
        }}
        integrity={{ state, hash: "a".repeat(64), evidenceMatches: false }}
      />
    </section>
  );
}
