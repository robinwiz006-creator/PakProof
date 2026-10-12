import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { PageHeading, Empty } from "@/components/ui";
import { PaymentRecovery } from "@/components/milestone-payment";
import {
  tokenAmount,
  paymentStatusLabel,
  type PaymentAttempt,
} from "@/lib/payments";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const { db, user } = await credentialWorkspace();
  const { data, error } = await db
    .from("payment_intents")
    .select(
      "*,paid_milestones(title,project_id,paid_projects(title,worker_id)),payment_attempts(*)",
    )
    .order("created_at", { ascending: false });
  return (
    <div className="container page">
      <PageHeading
        eyebrow="PRIVATE PAYMENT WORKSPACE"
        title="Milestone payments"
        description="Keep work approval separate from payment. Only an independently checked, finalized token transfer is marked Paid."
      />
      <div className="button-row">
        <Link className="text-link" href="/paid-projects?view=mine">
          My projects
        </Link>
        <Link className="text-link" href="/paid-projects?view=company">
          Company projects
        </Link>
        <Link className="text-link" href="/wallet">
          Wallet ownership
        </Link>
      </div>
      <p className="notice section-spacer">
        Solana devnet test tokens, not real money. Details are private in
        ProofPak, but transfers, wallet addresses and amounts are publicly
        discoverable on Solana. Do not repay an unknown or pending transaction.
      </p>
      {error ? (
        <p className="notice">
          Payment history requires the new payment migration.
        </p>
      ) : !(data ?? []).length ? (
        <Empty title="No payment preparations yet">
          Accept project terms, submit work, and receive company approval before
          payment.
        </Empty>
      ) : (
        (data ?? []).map((i) => {
          const attempts = (i.payment_attempts ?? []) as PaymentAttempt[];
          const active =
            attempts.find((a) => !["failed", "cancelled"].includes(a.status)) ??
            attempts.at(-1) ??
            null;
          return (
            <article className="panel section-spacer" key={i.id}>
              <h2>
                {i.paid_milestones?.paid_projects?.title} ·{" "}
                {i.paid_milestones?.title}
              </h2>
              <span className={`tag status-${i.status}`}>
                {paymentStatusLabel(i.status)}
              </span>
              <p>{tokenAmount(String(i.amount_units))} test USDC</p>
              <p className="hash">From {i.payer_wallet}</p>
              <p className="hash">To {i.recipient_wallet}</p>
              <Link
                className="text-link"
                href={`/paid-projects/${i.paid_milestones?.project_id}`}
              >
                Open project ↗
              </Link>
              {active && <p className="muted">{active.status_note}</p>}
              {!["paid", "failed", "cancelled"].includes(i.status) && (
                <PaymentRecovery
                  attempt={active}
                  intentId={i.id}
                  canResume={i.payer_user_id === user.id}
                  canCancel={
                    (i.payer_user_id === user.id ||
                      i.paid_milestones?.paid_projects?.worker_id ===
                        user.id) &&
                    i.status === "prepared"
                  }
                />
              )}
              <details className="section-spacer">
                <summary>Attempt history</summary>
                {attempts.map((a) => (
                  <div className="section-spacer" key={a.id}>
                    <p>
                      {paymentStatusLabel(a.status)} ·{" "}
                      {a.created_at.slice(0, 10)}
                    </p>
                    <p className="muted">{a.status_note}</p>
                    {a.signature && (
                      <PaymentRecovery
                        attempt={a}
                        intentId={i.id}
                        canResume={i.payer_user_id === user.id}
                      />
                    )}
                  </div>
                ))}
              </details>
            </article>
          );
        })
      )}
    </div>
  );
}
