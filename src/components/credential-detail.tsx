import {
  credentialLifecycle,
  verificationCheckedAt,
} from "@/lib/credential-lifecycle";
import { organizationTrust } from "@/lib/organization-trust";
import { CredentialRecheck } from "./credential-recheck";
import { OrganizationTrust } from "./organization-trust";
import { CredentialCorrectionNotice } from "./credential-correction";
import { CredentialWorkContextView } from "./credential-work-context";
import { workContext } from "@/lib/challenge-assessment";
import Link from "next/link";
import {
  issuanceTrustLabel,
  issuanceProvenance,
} from "@/lib/issuer-permissions";
import { ArrowUpRight } from "lucide-react";
import type { Credential } from "@/lib/credentials";
import { credentialValidity } from "@/lib/credentials";
import type { CredentialIntegrity } from "@/lib/credential-verification";
import {
  canShareCredential,
  credentialVisibleAssessment,
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
  checkedAt,
  allowRecheck = false,
}: {
  credential: Credential;
  recipient: CredentialRecipient | null;
  integrity: CredentialIntegrity;
  canViewPrivate?: boolean;
  manageHref?: string;
  manageLabel?: string;
  checkedAt?: string;
  allowRecheck?: boolean;
}) {
  const shared = canShareCredential(c, recipient);
  const proof = c.credential_proofs?.[0];
  const evidence = credentialEvidenceUrl(c, shared, canViewPrivate);
  const website = safeCredentialWebsite(c.organizations?.companies?.website);
  const validity = credentialValidity(c);
  const lifecycle = credentialLifecycle(c),
    asOf = verificationCheckedAt(checkedAt);
  const assessmentContext = credentialVisibleAssessment(
    c,
    shared,
    canViewPrivate,
  );
  if (!shared && !canViewPrivate)
    return (
      <div className="credential-detail">
        <h1>Credential not public</h1>
        <p className="notice">
          Private record · this credential is not available for public
          verification. Its URL does not grant access.
        </p>
        <Link href="/">Return to ProofPak</Link>
      </div>
    );
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
              : validity === "Superseded"
                ? "An accepted correction replaces this historical record."
                : validity === "Expired"
                  ? "This credential’s expiry date has passed."
                  : "This credential’s issue date has not arrived."}
          </p>
        </aside>
      )}
      <section
        className="credential-summary"
        aria-label="Credential status summary"
      >
        <div>
          <span>Current credential status</span>
          <strong
            className={`credential-status status-${lifecycle.status.toLowerCase().replaceAll(" ", "-")}`}
          >
            {lifecycle.status}
          </strong>
          <p className="muted">{lifecycle.description}</p>
        </div>
        <div>
          <span>Recipient & visibility</span>
          <strong>
            {acceptanceLabels[c.credential_preferences.acceptance]}
          </strong>
          <p className="muted">
            {shared
              ? "Publicly shared by the recipient"
              : "Private · not available to public visitors"}
          </p>
        </div>
        <div>
          <span>Current issuer trust</span>
          <strong>
            {c.organizations
              ? organizationTrust(c.organizations).label
              : "Current issuer information unavailable"}
          </strong>
          <p className="muted">
            Current institutional verification is separate from category
            permission at issuance.
          </p>
        </div>
        <div>
          <span>Historical Solana integrity</span>
          <strong className={`credential-status integrity-${integrity.state}`}>
            {integrityLabel(integrity.state, Boolean(proof))}
          </strong>
          <p className="muted">
            {integrityDescriptions[integrity.state]} A matching historical
            record does not prove current validity or issuer identity.
          </p>
          {proof && (
            <a
              className="text-link"
              href={explorerLink(proof.signature)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Inspect stored transaction reference ↗
            </a>
          )}
        </div>
      </section>
      {asOf && (
        <p className="muted">
          This view checked at {asOf}. Current validity and issuer trust come
          from ProofPak; Solana checks the historical commitment. This is not an
          onchain revocation registry.
        </p>
      )}
      {allowRecheck && <CredentialRecheck />}
      {c.organizations?.issuer_status === "suspended" && (
        <p className="notice">
          The issuer’s current credential-issuing permission is suspended. This
          does not automatically revoke previously issued credentials.
        </p>
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
                {workContext(c.credential_challenge_context)
                  ? "Challenge-based recognition"
                  : c.program_name}
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
                Organization website{" "}
                <ArrowUpRight size={15} aria-hidden="true" />
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
      <OrganizationTrust organization={c.organizations} />
      {assessmentContext && (
        <CredentialWorkContextView context={assessmentContext} />
      )}
      {!workContext(c.credential_challenge_context) && (
        <p className="notice section-spacer">
          No structured assessment record is attached to this credential. This
          does not establish whether an assessment took place. Refer to the
          issuer’s description and any permitted supporting evidence.
        </p>
      )}
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
            View recipient’s Skill Passport{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        )}
        {manageHref && (
          <Link className="button secondary" href={manageHref}>
            {manageLabel ?? "Manage credential"}
          </Link>
        )}
      </div>
      <CredentialCorrectionNotice credential={c} />
      {(["failed", "mismatch", "missing"] as string[]).includes(
        integrity.state,
      ) && (
        <p className="notice credential-integrity-alert" role="alert">
          Blockchain check: {integrityLabel(integrity.state, Boolean(proof))}.{" "}
          {integrityDescriptions[integrity.state]}
        </p>
      )}
      <p className="muted section-spacer">
        {issuanceTrustLabel(c)}.{" "}
        {issuanceProvenance(c)?.representative_recorded
          ? "Issuing representative recorded privately by ProofPak; this staff attribution is not part of the v3 blockchain claim."
          : "Historical issuing representative was not recorded; no attribution has been invented."}
      </p>
      <details className="credential-verification-details">
        <summary>Verification Details</summary>
        <section
          className="credential-checks"
          aria-labelledby="credential-checks-heading"
        >
          <div className="credential-section-intro">
            <p className="eyebrow">UNDERSTAND THIS RECORD</p>
            <h2 id="credential-checks-heading">Four separate checks</h2>
            <p className="muted">
              Each answers a different question. None alone proves the
              underlying achievement is true.
            </p>
          </div>
          <dl className="credential-check-list">
            <div>
              <dt>Credential validity</dt>
              <dd>
                <strong
                  className={`credential-status status-${lifecycle.status.toLowerCase().replaceAll(" ", "-")}`}
                >
                  {lifecycle.status}
                </strong>
                <p className="muted">
                  {lifecycle.status === "Awaiting acceptance" ||
                  lifecycle.status === "Declined"
                    ? lifecycle.description
                    : validity === "Revoked"
                      ? "The issuing organization withdrew this credential. A historical blockchain record does not undo revocation."
                      : validity === "Superseded"
                        ? "An accepted correction replaces this historical record."
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
                <p className="muted">
                  The status above is the issuer’s current credential-issuing
                  permission, not its historical permission or institutional
                  verification level.
                </p>
                {c.organizations?.allowed_credential_types &&
                  !c.organizations.allowed_credential_types.includes(
                    c.credential_type,
                  ) && (
                    <p className="muted">
                      This category is not currently permitted for new issuance.
                      That alone does not revoke this historical credential.
                    </p>
                  )}
                <p>
                  {c.authorization_id
                    ? "Credential issuance authorization recorded at issuance. Institutional verification is shown separately."
                    : "Approval at issuance is unavailable."}
                </p>
                <p className="muted">
                  ProofPak approval is not independent proof of an
                  organization’s legal identity.
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
                <p className="muted">
                  {integrityDescriptions[integrity.state]}
                </p>
                {proof && (
                  <a
                    className="text-link"
                    href={explorerLink(proof.signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Inspect transaction on Solana Explorer{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
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
      </details>
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
            Open supporting evidence{" "}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </section>
      ) : (
        <p className="muted section-spacer">
          Supporting evidence has not been shared publicly.
        </p>
      )}
      <details className="credential-technical">
        <summary>Technical details</summary>
        <p className="muted">
          Identifiers and transaction data for inspecting this record. No
          private documents are written to Solana. The displayed name comes from
          the recipient’s current profile; the claim binds their account
          identifier. Private evidence is covered by its committed digest
          without revealing its contents.
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
