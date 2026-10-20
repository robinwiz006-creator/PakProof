import Link from "next/link";
import {
  MilestonePayment,
  PaymentRecovery,
} from "@/components/milestone-payment";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isConfigured, supabase, currentUser } from "@/lib/supabase/server";
import {
  PaidProjectBrief,
  ProjectMilestoneHeading,
} from "@/components/paid-project-brief";
import { PaidProjectApplication } from "@/components/paid-project-application";
import { projectApplicationState } from "@/lib/project-application";
import { Field, SubmitButton } from "@/components/forms";
import { projectData, milestoneData } from "@/lib/paid-data";
import {
  tokenAmount,
  paymentStatusLabel,
  type PaymentAttempt,
  type PaidOffer,
} from "@/lib/payments";
import {
  publishPaidProject,
  applyPaidProject,
  selectPaidWorker,
  respondPaidOffer,
  submitPaidMilestone,
  reviewPaidMilestone,
  authorizePayout,
  sharePaidWork,
  consentPaidWork,
} from "@/lib/paid-actions";
export const dynamic = "force-dynamic";
export default async function PaidProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !isConfigured()) notFound();
  const db = await supabase();
  const user = await currentUser();
  const { data, error } = await db
    .from("paid_projects")
    .select("*,companies(name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const p = projectData(data);
  const { message } = await searchParams;
  const [milestoneResult, memberResult, appResult, offerResult] =
    await Promise.all([
      db
        .from("paid_milestones")
        .select("*")
        .eq("project_id", id)
        .order("position"),
      user
        ? db
            .from("company_memberships")
            .select("role")
            .eq("company_id", p.company_id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      user
        ? db
            .from("paid_project_applications")
            .select("*")
            .eq("project_id", id)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
      user && p.current_offer_id
        ? db
            .from("paid_project_offers")
            .select("*")
            .eq("id", p.current_offer_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  if (
    [milestoneResult, memberResult, appResult, offerResult].some((r) => r.error)
  )
    throw new Error("Project terms and applications could not be loaded.");
  const ms = (milestoneResult.data ?? []).map(milestoneData);
  const member = memberResult.data,
    apps = appResult.data;
  const isCompany = Boolean(member),
    isWorker = user?.id === p.worker_id;
  const ownApp = (apps ?? []).find((a) => a.worker_id === user?.id);
  const offer = offerResult.data as unknown as PaidOffer | null;
  const ids = ms.map((m) => m.id),
    party = isWorker || isCompany;
  const [
    submissionResult,
    reviewResult,
    orgResult,
    walletResult,
    payoutResult,
    intentResult,
    receiptResult,
    historyResult,
  ] = await Promise.all([
    party && ids.length
      ? db
          .from("paid_milestone_submissions")
          .select("*")
          .in("milestone_id", ids)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    party && ids.length
      ? db
          .from("paid_milestone_reviews")
          .select("*")
          .in("milestone_id", ids)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    isCompany
      ? db
          .from("organizations")
          .select("id")
          .eq("company_id", p.company_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    party && user
      ? db
          .from("wallet_connections")
          .select("id,wallet_address,purpose,organization_id")
          .eq("user_id", user.id)
          .is("disconnected_at", null)
      : Promise.resolve({ data: [], error: null }),
    party && data.payout_authorization_id
      ? db
          .from("paid_payout_authorizations")
          .select("wallet_address")
          .eq("id", data.payout_authorization_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    party && ids.length
      ? db
          .from("payment_intents")
          .select("*,payment_attempts(*)")
          .in("milestone_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    party && ids.length
      ? db
          .from("payment_receipts")
          .select("milestone_id,signature")
          .in("milestone_id", ids)
      : Promise.resolve({ data: [], error: null }),
    party
      ? db
          .from("paid_work_history")
          .select("*")
          .eq("project_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (
    [
      submissionResult,
      reviewResult,
      orgResult,
      walletResult,
      payoutResult,
      intentResult,
      receiptResult,
      historyResult,
    ].some((r) => r.error)
  )
    throw new Error(
      "Milestone evidence and payment records could not be loaded. Please try again.",
    );
  const submissions = submissionResult.data,
    reviews = reviewResult.data,
    org = orgResult.data,
    payout = payoutResult.data,
    intents = intentResult.data,
    receipts = receiptResult.data,
    history = historyResult.data;
  const payerWallets = (walletResult.data ?? []).filter(
    (w) => w.purpose === "company_payer" && w.organization_id === org?.id,
  );
  const accountWallets = (walletResult.data ?? []).filter(
    (w) => w.purpose === "account",
  );
  const applicationState = projectApplicationState({
    signedIn: Boolean(user),
    companyMember: isCompany,
    hasApplication: Boolean(ownApp),
    status: p.status,
    deadline: p.deadline,
  });
  return (
    <div className="container page paid-detail">
      <PaidProjectBrief
        project={p}
        action={
          applicationState === "apply" ? (
            <PaidProjectApplication projectId={id} action={applyPaidProject} />
          ) : applicationState === "sign-in" ? (
            <Link className="button" href="/sign-in">
              Sign in to apply
            </Link>
          ) : applicationState === "applied" ? (
            <span className="tag">Application sent</span>
          ) : applicationState === "closed" ? (
            <span className="tag">Applications closed</span>
          ) : undefined
        }
      />
      <div className="button-row">
        <Link className="text-link" href="/paid-projects">
          Paid projects
        </Link>
        <Link
          className="text-link"
          href={
            isCompany && org
              ? `/wallet?purpose=company_payer&organization=${org.id}`
              : "/wallet"
          }
        >
          My Wallet
        </Link>
        <Link className="text-link" href="/payments">
          Payment history
        </Link>
        <Link className="text-link" href="/portal/talent/passport">
          My passport
        </Link>
      </div>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {isCompany && p.status === "draft" && (
        <form className="panel section-spacer" action={publishPaidProject}>
          <h2>Review before publishing</h2>
          <p>
            Check the scope, budget and milestones below. Published terms cannot
            be silently edited.
          </p>
          <input name="project_id" type="hidden" value={id} />
          <SubmitButton>Publish project</SubmitButton>
        </form>
      )}
      {ownApp && (
        <p className="notice section-spacer">
          Your application:{" "}
          {ownApp.status === "rejected" ? "Not selected" : ownApp.status}.{" "}
          {ownApp.status === "selected" && p.status === "offered"
            ? "Review the offer below before accepting."
            : "Track work and decisions on this page."}
        </p>
      )}
      {isCompany && (
        <section className="section-spacer">
          <h2>Applications</h2>
          {!(apps ?? []).length && (
            <p className="muted">No applications yet.</p>
          )}
          {(apps ?? []).map((a) => (
            <article className="panel section-spacer" key={a.id}>
              <h3>{a.applicant_name}</h3>
              <p>{a.pitch}</p>
              <a
                className="text-link"
                href={a.evidence_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Application evidence ↗
              </a>
              <p>{a.status}</p>
              {p.status === "published" && a.status === "applied" && (
                <form action={selectPaidWorker}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <input type="hidden" name="project_id" value={id} />
                  <SubmitButton>
                    Select worker and send fixed terms
                  </SubmitButton>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {offer && (isWorker || isCompany) && (
        <section className="panel section-spacer">
          <h2>
            {offer.response === "accepted" ? "Agreed terms" : "Project offer"} ·
            version {offer.version}
          </h2>
          <p>
            Company: {offer.terms.company_name} · {offer.response}
          </p>
          <details
            className="section-spacer"
            open={offer.response === "pending"}
          >
            <summary>Review the exact scope and milestones</summary>
            <h3>Project description</h3>
            <p className="project-requirements">{offer.terms.description}</p>
            <h3 className="section-spacer">Requirements</h3>
            <p className="project-requirements">{offer.terms.requirements}</p>
            <p>
              Total: {tokenAmount(offer.terms.budget_units)} test USDC · Due{" "}
              {offer.terms.deadline}
            </p>
            <ol className="offer-milestones">
              {offer.terms.milestones.map((m) => (
                <li key={m.id}>
                  <h4>{m.title}</h4>
                  <p className="project-requirements">{m.deliverables}</p>
                  <p className="muted">
                    {tokenAmount(m.amount_units)} test USDC · Due {m.deadline}
                  </p>
                </li>
              ))}
            </ol>
            <p className="muted">
              Accepted terms cannot be edited. Changes require a separately
              agreed project. Work approval does not mean payment is complete.
            </p>
          </details>
          {isWorker && offer.response === "pending" && (
            <form action={respondPaidOffer}>
              <input type="hidden" name="offer_id" value={offer.id} />
              <input type="hidden" name="project_id" value={id} />
              <label className="field">
                Decision
                <select name="decision">
                  <option value="decline">Decline this offer</option>
                  <option value="accept">Accept these exact terms</option>
                </select>
              </label>
              <SubmitButton>Confirm decision</SubmitButton>
            </form>
          )}
        </section>
      )}
      {(isWorker || isCompany) && payout && (
        <p className="notice section-spacer hash">
          Authorized payout wallet: {payout.wallet_address}
        </p>
      )}
      {isWorker && p.status === "active" && (
        <section className="panel section-spacer">
          <h2>Authorize your payout wallet</h2>
          <p className="muted">
            Choose your verified personal wallet. Active agreements or
            unresolved payments may block replacement.
          </p>
          {accountWallets.length ? (
            <form action={authorizePayout}>
              <input type="hidden" name="project_id" value={id} />
              <label className="field">
                My verified payout wallet
                <select name="connection_id">
                  {accountWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.wallet_address}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton>Authorize this destination</SubmitButton>
            </form>
          ) : (
            <Link className="text-link" href="/wallet">
              First link an account wallet ↗
            </Link>
          )}
        </section>
      )}
      {p.status === "completed" && (isWorker || isCompany) && (
        <section className="panel section-spacer">
          <h2>Add completed work to the passport</h2>
          <p className="muted">
            Choose whether to share this work. Company consent and separate
            evidence permission are required. Private terms and amounts stay off
            your passport; blockchain transactions remain publicly discoverable.
          </p>
          {isCompany && (
            <form action={consentPaidWork}>
              <input type="hidden" name="project_id" value={id} />
              <label>
                <input
                  name="consent"
                  type="checkbox"
                  defaultChecked={history?.company_consent ?? false}
                />{" "}
                Allow disclosure of company name, completed work and approved
                evidence chosen by the worker
              </label>
              <div className="section-spacer">
                <SubmitButton>Save company consent</SubmitButton>
              </div>
            </form>
          )}
          {isWorker && (
            <form action={sharePaidWork}>
              <input type="hidden" name="project_id" value={id} />
              <Field
                label="My work summary (optional, self-reported)"
                name="summary"
                type="textarea"
                maxLength={4000}
                value={history?.recipient_summary ?? ""}
              />
              <label>
                <input
                  name="is_public"
                  type="checkbox"
                  defaultChecked={history?.is_public ?? false}
                />{" "}
                Add this completed work to my published passport
              </label>
              <br />
              <label>
                <input
                  name="share_evidence"
                  type="checkbox"
                  defaultChecked={history?.share_evidence ?? false}
                />{" "}
                Also publish approved evidence
              </label>
              <p className="muted">
                Company disclosure consent:{" "}
                {history?.company_consent ? "Granted" : "Not granted yet"}. A
                private passport remains private.
              </p>
              <SubmitButton>Save work history preferences</SubmitButton>
            </form>
          )}
          {isCompany && (
            <p className="section-spacer">
              Payment does not issue a credential. An authorized organization
              may{" "}
              <Link className="text-link" href="/organizations">
                separately recognize the work with a credential ↗
              </Link>
              .
            </p>
          )}
        </section>
      )}
      <section className="section-spacer">
        <h2>Milestones</h2>
        <p className="muted">
          Each milestone is reviewed and paid separately. Approval is not
          payment.
        </p>
        {ms.map((m) => {
          const submission = (submissions ?? []).find(
            (s) => s.id === m.current_submission_id,
          );
          const intent = (intents ?? []).find(
            (i) =>
              i.milestone_id === m.id &&
              !["failed", "cancelled"].includes(i.status),
          );
          const receipt = (receipts ?? []).find((r) => r.milestone_id === m.id);
          const attempt = (intent?.payment_attempts ?? []).find(
            (a: PaymentAttempt) => !["failed", "cancelled"].includes(a.status),
          ) as PaymentAttempt | undefined;
          return (
            <article className="project-milestone section-spacer" key={m.id}>
              <ProjectMilestoneHeading milestone={m} />
              {(isCompany || isWorker) && (
                <>
                  <span className="tag">
                    Work: {m.work_status.replaceAll("_", " ")}
                  </span>
                  {submission && (
                    <div className="section-spacer">
                      <h4>Submitted work</h4>
                      <p>{submission.explanation}</p>
                      <a
                        className="text-link"
                        href={submission.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Private submitted evidence ↗
                      </a>
                    </div>
                  )}
                  {(reviews ?? [])
                    .filter((r) => r.milestone_id === m.id)
                    .map((r) => (
                      <p className="notice section-spacer" key={r.id}>
                        {r.decision}: {r.feedback}
                      </p>
                    ))}
                  {isWorker &&
                    p.status === "active" &&
                    ["not_submitted", "revisions"].includes(m.work_status) && (
                      <form
                        className="section-spacer"
                        action={submitPaidMilestone}
                      >
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="milestone_id" value={m.id} />
                        <Field
                          name="explanation"
                          label="Work completed and explanation"
                          type="textarea"
                          required
                          minLength={20}
                          maxLength={5000}
                        />
                        <Field
                          name="evidence_url"
                          label="Work evidence URL"
                          type="url"
                          required
                        />
                        <SubmitButton>
                          {m.work_status === "revisions"
                            ? "Submit revised work"
                            : "Submit milestone work"}
                        </SubmitButton>
                      </form>
                    )}
                  {isCompany && m.work_status === "submitted" && (
                    <form
                      className="section-spacer"
                      action={reviewPaidMilestone}
                    >
                      <input type="hidden" name="project_id" value={id} />
                      <input type="hidden" name="milestone_id" value={m.id} />
                      <Field
                        name="feedback"
                        label="Review feedback"
                        type="textarea"
                        required
                        minLength={10}
                        maxLength={2000}
                      />
                      <label className="field">
                        Decision
                        <select name="decision">
                          <option value="revisions">Request revisions</option>
                          <option value="approved">
                            Approve work (payment still due)
                          </option>
                        </select>
                      </label>
                      <SubmitButton>Save review</SubmitButton>
                    </form>
                  )}
                  {m.work_status === "approved" && (
                    <>
                      <p className="notice section-spacer">
                        Work approved ·{" "}
                        {receipt
                          ? "Paid after finalized settlement"
                          : "payment due"}
                        . Approval is separate from payment.
                      </p>
                      <p className="tag">
                        Payment:{" "}
                        {receipt
                          ? "Paid"
                          : intent
                            ? paymentStatusLabel(intent.status)
                            : "Not paid"}
                      </p>
                      {attempt?.status_note && (
                        <p className="muted section-spacer">
                          {attempt.status_note}
                        </p>
                      )}
                      {intent && (
                        <PaymentRecovery
                          attempt={attempt ?? null}
                          intentId={intent.id}
                          canCancel={
                            (member?.role === "owner" || isWorker) &&
                            intent.status === "prepared"
                          }
                          canResume={intent.payer_user_id === user?.id}
                        />
                      )}
                      {!receipt &&
                        member?.role === "owner" &&
                        (!intent || intent.status === "prepared") && (
                          <MilestonePayment
                            milestoneId={m.id}
                            payerWallets={payerWallets}
                          />
                        )}
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
