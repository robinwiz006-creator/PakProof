import Link from "next/link";
import type { Credential } from "@/lib/credentials";
import { credentialValidity } from "@/lib/credentials";
import type { CredentialIntegrity } from "@/lib/credential-verification";
import {
  canShareCredential,
  credentialDate,
  credentialEvidenceUrl,
  safeCredentialWebsite,
  acceptanceLabels,
  issuerLabels,
  integrityLabel,
  integrityDescriptions,
  type CredentialRecipient,
} from "@/lib/credential-presentation";
import { explorerLink } from "@/lib/proof";
import { CredentialShare } from "./credential-share";
export function CredentialDetail({
  credential: c,
  recipient,
  integrity,
  canViewPrivate = false,
  manageHref,
  manageLabel,
}: {
  credential: Credential;
  recipient: CredentialRecipient | null;
  integrity: CredentialIntegrity;
  canViewPrivate?: boolean;
  manageHref?: string;
  manageLabel?: string;
}) {
  const shared = canShareCredential(c, recipient);
  const proof = c.credential_proofs?.[0];
  const evidence = credentialEvidenceUrl(c, shared, canViewPrivate);
  const website = safeCredentialWebsite(c.organizations?.companies?.website);
  const validity = credentialValidity(c);
  return (
    <div className="credential-detail">
      <div className="credential-page-top">
        <Link className="text-link" href="/">
          ProofPak
        </Link>
        <span>{shared ? "Public credential" : "Private credential"}</span>
      </div>
      {!shared && (
        <p className="notice">
          Private record · only its recipient and issuing organization can
          access it. This URL does not make it public.
        </p>
      )}
      {validity !== "Current" && (
        <aside
          className="notice credential-validity-alert"
          role="note"
          aria-label="Credential validity alert"
        >
          <strong>{validity} credential</strong>
          <p>
            {validity === "Revoked"
              ? "The issuer withdrew this credential. A matching historical blockchain record does not make it current."
              : validity === "Expired"
                ? "This credential’s expiry date has passed."
                : "This credential’s issue date has not arrived."}
          </p>
        </aside>
      )}
      <article
        className="credential-certificate"
        aria-label="Credential certificate"
      >
        <header>
          <span className="credential-wordmark">
            ProofPak<span> / Credential</span>
          </span>
          <p className="eyebrow">{c.credential_type.replaceAll("_", " ")}</p>
        </header>
        <h1>{c.title}</h1>
        <div className="credential-recipient">
          <p className="eyebrow">ISSUED TO</p>
          <h2>{recipient?.full_name || "Private recipient"}</h2>
        </div>
        {c.description && (
          <p className="credential-description">{c.description}</p>
        )}
        {(c.program_name || c.award) && (
          <div className="credential-recognition">
            {c.program_name && (
              <p>
                <span>Program / event</span>
                {c.program_name}
              </p>
            )}
            {c.award && (
              <p>
                <span>Recognition</span>
                {c.award}
              </p>
            )}
          </div>
        )}
        <footer className="credential-issued">
          <div>
            <p className="eyebrow">ISSUED BY</p>
            <h3>{c.issuer_name}</h3>
            {website && (
              <a
                className="text-link"
                href={website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Organization website ↗
              </a>
            )}
          </div>
          <div>
            <p className="eyebrow">ISSUE DATE</p>
            <p className="credential-date">
              <time dateTime={c.issue_date}>
                {credentialDate(c.issue_date)}
              </time>
            </p>
            {c.expiry_date && (
              <p className="muted">Expires {credentialDate(c.expiry_date)}</p>
            )}
          </div>
        </footer>
      </article>
      <div className="credential-actions-row">
        {shared ? (
          <CredentialShare id={c.id} />
        ) : (
          <p className="muted">
            To share publicly, the recipient must accept this credential, enable
            its publication, and publish their passport.
          </p>
        )}
        {shared && recipient && (
          <Link className="text-link" href={`/talent/${recipient.slug}`}>
            View recipient’s Skill Passport ↗
          </Link>
        )}
        {manageHref && (
          <Link className="button secondary" href={manageHref}>
            {manageLabel ?? "Manage credential"}
          </Link>
        )}
      </div>
      <section
        className="credential-checks"
        aria-labelledby="credential-checks-heading"
      >
        <div className="credential-section-intro">
          <p className="eyebrow">UNDERSTAND THIS RECORD</p>
          <h2 id="credential-checks-heading">Four separate checks</h2>
          <p className="muted">
            Each answers a different question. None alone proves the underlying
            achievement is true.
          </p>
        </div>
        <dl className="credential-check-list">
          <div>
            <dt>Credential validity</dt>
            <dd>
              <strong
                className={`credential-status status-${validity.toLowerCase().replaceAll(" ", "-")}`}
              >
                {validity}
              </strong>
              <p className="muted">
                {validity === "Revoked"
                  ? "The issuing organization withdrew this credential. A historical blockchain record does not undo revocation."
                  : validity === "Expired"
                    ? "The expiry date has passed."
                    : validity === "Not yet valid"
                      ? "The issue date is in the future."
                      : c.expiry_date
                        ? `Valid through ${credentialDate(c.expiry_date)}, unless revoked.`
                        : "No expiry date specified; no revocation recorded."}
              </p>
            </dd>
          </div>
          <div>
            <dt>Recipient decision</dt>
            <dd>
              <strong>
                {acceptanceLabels[c.credential_preferences.acceptance]}
              </strong>
              <p className="muted">
                {c.credential_preferences.acceptance === "accepted"
                  ? "Acceptance does not automatically publish a credential or verify its contents."
                  : c.credential_preferences.acceptance === "declined"
                    ? "The recipient declined this credential. It cannot appear on their public passport."
                    : "The recipient has not accepted this credential. It is not public."}
              </p>
            </dd>
          </div>
          <div>
            <dt>Organization approval</dt>
            <dd>
              <strong>
                {issuerLabels[c.organizations?.issuer_status ?? ""] ??
                  "Current approval unavailable"}
              </strong>
              <p>
                {c.authorization_id
                  ? "ProofPak approval recorded at issuance."
                  : "Approval at issuance is unavailable."}
              </p>
              <p className="muted">
                ProofPak approval is not independent proof of an organization’s
                legal identity.
              </p>
            </dd>
          </div>
          <div>
            <dt>Blockchain integrity</dt>
            <dd>
              <strong
                className={`credential-status integrity-${integrity.state}`}
              >
                {integrityLabel(integrity.state, Boolean(proof))}
              </strong>
              <p className="muted">{integrityDescriptions[integrity.state]}</p>
              {proof && (
                <a
                  className="text-link"
                  href={explorerLink(proof.signature)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inspect transaction on Solana Explorer ↗
                </a>
              )}
              <p className="muted">
                Solana devnet · checks record integrity, not the truth of the
                achievement.
              </p>
            </dd>
          </div>
        </dl>
      </section>
      {c.credential_events.map((event, index) => (
        <aside
          className="notice section-spacer"
          key={`${event.created_at}-${index}`}
        >
          <strong>Revoked {credentialDate(event.created_at)}</strong>
          <p>{event.reason}</p>
        </aside>
      ))}
      {evidence ? (
        <section className="credential-evidence">
          <h2>Supporting evidence</h2>
          <p className="muted">
            {shared && c.credential_preferences.share_evidence
              ? "The recipient has chosen to share this evidence."
              : "Private evidence · visible here only to the recipient and issuing organization."}
          </p>
          <a
            className="text-link"
            href={evidence}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open supporting evidence ↗
          </a>
        </section>
      ) : (
        <p className="muted section-spacer">
          Supporting evidence is not available for public viewing. When evidence
          is private, the integrity check covers its committed digest without
          revealing its contents.
        </p>
      )}
      <details className="credential-technical">
        <summary>Technical details</summary>
        <p className="muted">
          Identifiers and transaction data for inspecting this record. No
          private documents are written to Solana. The displayed name comes from
          the recipient’s current profile; the claim binds their account
          identifier.
        </p>
        <dl>
          <dt>Credential ID</dt>
          <dd>{c.id}</dd>
          <dt>Authorization reference at issuance</dt>
          <dd>{c.authorization_id || "Unavailable"}</dd>
          <dt>Claim format</dt>
          <dd>v3 · organization credential · Solana Memo</dd>
          <dt>Recomputed claim hash</dt>
          <dd>{integrity.hash ?? "Could not compute"}</dd>
          <dt>Committed evidence digest</dt>
          <dd>{c.evidence_digest}</dd>
          {proof && (
            <>
              <dt>Recorded claim hash</dt>
              <dd>{proof.record_hash}</dd>
              <dt>Transaction signature</dt>
              <dd>{proof.signature}</dd>
              <dt>Issuer signing wallet</dt>
              <dd>{proof.issuer_wallet}</dd>
              <dt>Record anchored</dt>
              <dd>{credentialDate(proof.anchored_at)}</dd>
            </>
          )}
        </dl>
      </details>
    </div>
  );
}
