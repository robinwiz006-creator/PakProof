"use client";
import { PaymentRecovery } from "./milestone-payment";
import { ProofAnchor } from "./proof-anchor";
import { CredentialAnchor } from "./credential-anchor";
export function TransactionRecoveryFixture({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  return (
    <main className="container page narrow">
      <h1>Offline transaction recovery fixture</h1>
      <p>
        Mocked API responses only. No database changes, wallet approvals or real
        blockchain verification.
      </p>
      <section aria-label="Payment cancellation">
        <h2>Payment recovery</h2>
        <PaymentRecovery
          attempt={{
            id: "a0000000-0000-4000-8000-000000000006",
            signature: null,
            status: cancelled ? "cancelled" : "prepared",
          }}
          intentId="a0000000-0000-4000-8000-000000000007"
          canCancel
          canResume
        />
      </section>
      <section aria-label="Achievement proof recovery">
        <ProofAnchor achievementId="a0000000-0000-4000-8000-000000000009" />
      </section>
      <section aria-label="Credential proof recovery">
        <CredentialAnchor achievementId="a0000000-0000-4000-8000-000000000010" />
      </section>
    </main>
  );
}
