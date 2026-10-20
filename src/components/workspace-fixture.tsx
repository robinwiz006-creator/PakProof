"use client";
import { PaidProjectEditor } from "./paid-project-editor";
import { IssuerQueue } from "./issuer-queue";
import { useState } from "react";
import { WalletLinks } from "./wallet-links";
import { WalletManager } from "./wallet-manager";
import { ConfirmForm } from "./confirm-form";
import { PaidProjectBrowser } from "./paid-project-browser";
export function WorkspaceFixture() {
  const [decisions, setDecisions] = useState(0);
  return (
    <div className="container page">
      <h1>Isolated UI test fixtures</h1>
      <p className="notice">
        Test-only components. No organization, payment, or credential is
        created. No blockchain transaction is sent.
      </p>
      <section className="panel">
        <h2>Confirmation fixture</h2>
        <ConfirmForm
          action={async () => {
            setDecisions((n) => n + 1);
          }}
          title="Confirm fixture decision"
          message="This only increments a local test counter."
        >
          <label className="field">
            Private fixture note
            <input name="note" required minLength={20} />
          </label>
          <button type="submit" className="button">
            Review fixture decision
          </button>
        </ConfirmForm>
        <p role="status">Recorded fixture decisions: {decisions}</p>
      </section>
      <section className="section-spacer">
        <h2>Administrator queue component fixture</h2>
        <IssuerQueue
          organizations={[
            {
              id: "40000000-0000-4000-8000-000000000001",
              company_id: "40000000-0000-4000-8000-000000000002",
              organization_type: "other",
              issuer_status: "pending",
              authorization_id: null,
              created_at: "2026-10-13T00:00:00Z",
              companies: {
                name: "UI fixture organization — not an authorized issuer",
                description: "Isolated visual test only",
                website: "",
              },
            },
          ]}
        />
      </section>
      <section aria-label="Linked wallet display fixtures">
        <p>
          Offline linked-wallet display fixtures — not real linked accounts.
        </p>
        <WalletLinks
          links={[
            {
              id: "60000000-0000-4000-8000-000000000001",
              wallet_address: "11111111111111111111111111111111",
              purpose: "account",
              organization_id: null,
              disconnected_at: null,
              lock_reason: "Fixture: an unresolved payment prevents unlinking.",
              created_at: "2026-10-13T00:00:00Z",
            },
            {
              id: "60000000-0000-4000-8000-000000000002",
              wallet_address: "11111111111111111111111111111112",
              purpose: "credential_issuer",
              organization_id: "fixture-org",
              disconnected_at: "2026-10-14T00:00:00Z",
              lock_reason: null,
              created_at: "2026-10-13T00:00:00Z",
            },
          ]}
          organizationNames={{ "fixture-org": "Offline fixture organization" }}
        />
      </section>
      <WalletManager
        organizations={[
          {
            id: "40000000-0000-4000-8000-000000000001",
            name: "UI fixture organization (not authorized)",
            role: "owner",
            issuerStatus: "pending",
          },
        ]}
      />
      <section className="section-spacer">
        <h2>Paid-project editor component fixture (not saved)</h2>
        <PaidProjectEditor
          companies={[
            {
              id: "40000000-0000-4000-8000-000000000001",
              name: "UI fixture company — not a real opportunity",
            },
          ]}
        />
      </section>
      <PaidProjectBrowser
        items={[
          {
            id: "50000000-0000-4000-8000-000000000001",

            title: "UI fixture: frontend project",
            description: "An isolated listing fixture, not a real opportunity.",

            skills: ["TypeScript"],
            deadline: "2026-12-01",
            budget_units: "10000000",
            status: "published",

            companies: { name: "UI fixture organization" },
          },
        ]}
      />
    </div>
  );
}
