import { DashboardAttentionFixture } from "@/components/dashboard-attention-fixture";
import { OrganizationVerificationFixture } from "@/components/organization-verification-fixture";
import { ContactHandoffFixture } from "@/components/contact-handoff-fixture";
import { TransactionRecoveryFixture } from "@/components/transaction-recovery-fixture";
import { PaidProjectEditor } from "@/components/paid-project-editor";
import {
  PaymentRecovery,
  MilestonePayment,
} from "@/components/milestone-payment";
import { EmployerDiscoveryFixture } from "@/components/employer-discovery-fixture";
import { ChallengeAssessmentFixture } from "@/components/challenge-assessment-fixture";
import { IssuerTypeFields } from "@/components/issuer-type-fields";
import { notFound } from "next/navigation";
import { isConfigured } from "@/lib/supabase/server";
import { CredentialDetailFixture } from "@/components/credential-detail-fixture";
import { OpportunityUXFixture } from "@/components/opportunity-ux-fixture";
import { PortalNav } from "@/components/portal-nav";
import { WorkspaceFixture } from "@/components/workspace-fixture";
export const dynamic = "force-dynamic";
export default async function TestUI({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  // Isolated component fixtures only. Never available with configured Supabase.
  if (process.env.PROOFPAK_E2E !== "1" || isConfigured()) notFound();
  const { fixture } = await searchParams;
  if (fixture === "dashboard-attention") return <DashboardAttentionFixture />;
  if (fixture === "organization-verification")
    return <OrganizationVerificationFixture />;
  if (fixture === "contact-handoff") return <ContactHandoffFixture />;
  if (
    fixture === "transaction-recovery" ||
    fixture === "transaction-recovery-cancelled"
  )
    return (
      <TransactionRecoveryFixture
        cancelled={fixture === "transaction-recovery-cancelled"}
      />
    );
  if (fixture === "paid-lifecycle")
    return (
      <main className="container page narrow">
        <h1>Offline paid lifecycle fixture</h1>
        <p>No payment is sent and no database record is saved.</p>
        <PaidProjectEditor
          companies={[
            {
              id: "a0000000-0000-4000-8000-000000000001",
              name: "Fixture organization",
            },
          ]}
          initial={{
            id: "a0000000-0000-4000-8000-000000000002",
            company_id: "a0000000-0000-4000-8000-000000000001",
            title: "Draft accessibility project",
            description:
              "Build an accessible dashboard and document how it works.",
            requirements:
              "Deliver source code and an accessible deployed dashboard.",
            skills: ["React"],
            deadline: "2030-12-01",
            budget_units: "1250000",
            status: "draft",
            worker_id: null,
            current_offer_id: null,
          }}
          milestones={[
            {
              id: "a0000000-0000-4000-8000-000000000003",
              project_id: "a0000000-0000-4000-8000-000000000002",
              position: 1,
              title: "Dashboard delivery",
              deliverables:
                "Accessible deployed dashboard and documented source code.",
              deadline: "2030-11-01",
              amount_units: "1250000",
              work_status: "not_submitted",
              current_submission_id: null,
              approval_id: null,
            },
          ]}
          expected="{}"
        />
        <h2>Unsigned browser recovery</h2>
        <PaymentRecovery
          attempt={{
            id: "a0000000-0000-4000-8000-000000000006",
            signature: null,
            status: "prepared",
          }}
          intentId="a0000000-0000-4000-8000-000000000007"
          canResume
        />
        <MilestonePayment
          milestoneId="a0000000-0000-4000-8000-000000000003"
          payerWallets={[
            {
              id: "a0000000-0000-4000-8000-000000000008",
              wallet_address: "Offline fixture payer — not a real wallet",
            },
          ]}
        />
        <h2>Unknown payment outcome</h2>
        <PaymentRecovery
          attempt={{
            id: "a0000000-0000-4000-8000-000000000004",
            signature: "offline-fixture-signature-not-a-real-transfer",
            status: "needs_review",
          }}
          intentId="a0000000-0000-4000-8000-000000000005"
        />
      </main>
    );
  if (fixture === "employer-discovery") return <EmployerDiscoveryFixture />;
  if (fixture === "challenge-assessment") return <ChallengeAssessmentFixture />;
  if (fixture === "issuer-permissions")
    return (
      <main className="container page narrow">
        <h1>Isolated issuer permission fixture</h1>
        <p>Offline form only; no organization or credential is created.</p>
        <IssuerTypeFields
          organizations={[
            {
              id: "training-fixture",
              name: "Training fixture",
              types: ["course", "workshop"],
            },
            {
              id: "academic-fixture",
              name: "Academic fixture",
              types: ["degree"],
            },
            { id: "legacy-fixture", name: "Legacy fixture", types: [] },
          ]}
        />
      </main>
    );
  if (fixture === "opportunities") return <OpportunityUXFixture />;
  if (fixture === "navigation")
    return (
      <div className="workspace-frame">
        <PortalNav workspace />
        <div className="workspace-body container page">
          <h1>Shared navigation fixture</h1>
          <p className="notice">
            Offline navigation layout only. No organization or account
            permissions are granted.
          </p>
        </div>
      </div>
    );
  if (fixture === "wallet") return <WorkspaceFixture walletOnly />;
  if (fixture === "inbox") return <CredentialDetailFixture inbox />;
  if (fixture === "credential") return <CredentialDetailFixture />;
  return <WorkspaceFixture />;
}
