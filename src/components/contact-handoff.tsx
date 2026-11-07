import Link from "next/link";
import { Field, SubmitButton } from "./forms";
import {
  canFollowup,
  contactStatus,
  type ContactNote,
  type ContactOpportunity,
} from "@/lib/contact-handoff";
export function ContactHandoff({
  id,
  organization,
  purpose,
  status,
  candidate,
  consent,
  notes,
  opportunity,
  nonce,
  send,
  close,
}: {
  id: string;
  organization: string;
  purpose: string;
  status: string;
  candidate: boolean;
  consent: boolean;
  notes: ContactNote[];
  opportunity: ContactOpportunity | null;
  nonce: string;
  send: (f: FormData) => Promise<void>;
  close: (f: FormData) => Promise<void>;
}) {
  const count = notes.filter(
    (n) => n.sender === (candidate ? "candidate" : "organization"),
  ).length;
  return (
    <>
      <header className="section-spacer">
        <p className="eyebrow">PRIVATE CONTACT REQUEST</p>
        <h1>{organization}</h1>
        <span className="tag">{contactStatus(status)}</span>
        <h2 className="section-spacer">Purpose</h2>
        <p>{purpose}</p>
        <p className="muted">
          Visible only to this candidate and authorized members of this
          organization. No email or phone number is shared automatically.
        </p>
      </header>
      {opportunity && (
        <section className="panel section-spacer">
          <h2>{opportunity.title ?? "Linked opportunity"}</h2>
          <p>
            {opportunity.kind === "paid-project"
              ? "Paid project"
              : "Skill challenge"}{" "}
            · {opportunity.status}
            {opportunity.deadline ? ` · Deadline ${opportunity.deadline}` : ""}
          </p>
          {opportunity.kind === "paid-project" && (
            <p className="muted">
              Payments use devnet test tokens with no monetary value. Payment is
              not guaranteed.
            </p>
          )}
          {opportunity.status === "Open" && opportunity.href ? (
            <Link className="button secondary" href={opportunity.href}>
              {candidate ? "View opportunity and apply" : "View opportunity"}
            </Link>
          ) : (
            <p className="muted">
              This opportunity is no longer open or publicly available.
            </p>
          )}
          <p className="muted">
            Accepting contact does not apply, agree to work, or create a
            payment.
          </p>
        </section>
      )}
      <section className="section-spacer">
        <h2>Follow-up</h2>
        <p className="muted">
          Up to six short notes per side to agree on a next step. No attachments
          or live chat. Share personal contact details only if you choose to.
        </p>
        {notes.length ? (
          <ol className="form">
            {notes.map((n) => (
              <li className="panel" key={n.id}>
                <strong>
                  {n.sender === "candidate" ? "Candidate" : organization} ·{" "}
                  {n.topic.replaceAll("_", " ")}
                </strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {n.body}
                </p>
                <time className="muted" dateTime={n.created_at}>
                  {new Date(n.created_at)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  UTC
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="notice">
            {status === "accepted"
              ? "Start with a question or suggest a next step."
              : "Follow-up becomes available only after the candidate accepts."}
          </p>
        )}
        {status === "accepted" && !consent && (
          <p className="notice">
            Contact is paused by your privacy settings. You can close it now, or
            review your discovery and contact preferences.
          </p>
        )}
        {canFollowup(status, consent, count) ? (
          <form action={send} className="form section-spacer">
            <input type="hidden" name="request_id" value={id} />
            <input type="hidden" name="nonce" value={nonce} />
            <label className="field">
              Topic
              <select name="topic" required>
                <option value="next_steps">Suggest next steps</option>
                <option value="question">Ask a question</option>
                <option value="response">Respond</option>
              </select>
            </label>
            <Field
              name="body"
              label="Private follow-up"
              type="textarea"
              minLength={10}
              maxLength={1000}
              required
            />
            <p className="muted">{6 - count} notes remaining for your side.</p>
            <SubmitButton>Send follow-up</SubmitButton>
          </form>
        ) : status === "accepted" && consent ? (
          <p className="notice">
            Your six-note limit is reached. Continue through the next step you
            agreed on, or close contact.
          </p>
        ) : status !== "pending" ? (
          <p className="notice">
            This contact has ended. No further notes can be sent.
          </p>
        ) : null}
      </section>
      {((candidate && status === "accepted") ||
        (!candidate && ["pending", "accepted"].includes(status))) && (
        <details className="section-spacer">
          <summary>
            {candidate ? "Stop contact" : "Withdraw this request"}
          </summary>
          <p>
            Ends follow-up permanently. Existing notes remain in the private
            request history. This does not cancel an application, agreement, or
            payment.
          </p>
          <form action={close} className="form">
            <input name="request_id" type="hidden" value={id} />
            {!candidate && <input name="withdraw" type="hidden" value="yes" />}
            <label>
              <input type="checkbox" required /> I want to end this contact
              request.
            </label>
            <SubmitButton>
              {candidate ? "Close contact" : "Withdraw request"}
            </SubmitButton>
          </form>
        </details>
      )}
    </>
  );
}
