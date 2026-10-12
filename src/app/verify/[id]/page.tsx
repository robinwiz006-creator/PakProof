import { verificationState, verificationLabels } from "@/lib/proof-status";
import { achievementRecord } from "@/lib/proof-record";
import { ApprovedEvidence } from "@/components/passport-view";
import { notFound } from "next/navigation";
import { achievement } from "@/lib/data";
import {
  hashRecord,
  evidenceDigest,
  serializeRecord,
  explorerLink,
} from "@/lib/proof";
import { checkAnchor } from "@/lib/solana";
import { PageHeading, ButtonLink } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Verify({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await achievement(id);
  if (!a) notFound();
  const proof = a.blockchain_proofs?.[0];
  const version = proof?.claim_version ?? (proof ? 1 : 2);
  const record = achievementRecord(a, version);
  const hash = await hashRecord(record);
  let status = "Onchain proof pending",
    details =
      "The company approved this work. A devnet proof has not been recorded yet.";
  const evidenceMatches =
    version === 1 ||
    !a.achievement_evidence ||
    (await evidenceDigest(a.achievement_evidence)) ===
      a.achievement_claims?.evidence_digest;
  if (proof) {
    if (proof.record_hash !== hash || !evidenceMatches) {
      status = "Record hash mismatch";
      details =
        "The current achievement does not match the stored proof. Do not treat it as verified.";
    } else {
      try {
        const checked = await checkAnchor(
          proof.signature,
          hash,
          proof.issuer_wallet,
          version,
        );
        status =
          verificationLabels[
            verificationState({ stored: true, hashMatches: true, checked })
          ];
        details = checked.valid
          ? "The current record hash matches a successful finalized Solana devnet memo transaction signed by the recorded wallet. When approved evidence is available to you, its digest is also checked."
          : "No matching finalized transaction was found. Devnet may have been reset, or the transaction does not match this achievement.";
      } catch {
        status = "Network verification unavailable";
        details =
          "The stored hash matches this record, but the live devnet request failed. Onchain verification has not been confirmed; try again later.";
      }
    }
  }
  return (
    <div className="container page">
      <PageHeading
        eyebrow="ACHIEVEMENT VERIFICATION"
        title={a.title}
        description={`Company recognition from ${a.achievement_claims?.issuer_name ?? a.companies?.name ?? "the issuing company"}`}
      />
      <ApprovedEvidence
        achievement={a}
        projectHref={
          a.profiles?.is_public && a.achievement_sharing?.project_id
            ? `/talent/${a.profiles.slug}#project-${a.achievement_sharing.project_id}`
            : undefined
        }
      />
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>{status}</h2>
            <p className="muted" role="status">
              {details}
            </p>
            <dl className="meta-list">
              <div>
                <dt>Issued to</dt>
                <dd>{a.profiles?.full_name ?? "Private profile"}</dd>
              </div>
              <div>
                <dt>Approved on</dt>
                <dd>
                  {new Date(a.issued_at).toLocaleString("en-GB", {
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </dd>
              </div>
              <div>
                <dt>Recomputed SHA-256 record hash</dt>
                <dd className="hash">{hash}</dd>
              </div>
              {proof && (
                <>
                  <div>
                    <dt>Issuer wallet</dt>
                    <dd className="hash">{proof.issuer_wallet}</dd>
                  </div>
                  <div>
                    <dt>Transaction signature</dt>
                    <dd className="hash">{proof.signature}</dd>
                  </div>
                </>
              )}
            </dl>
            {proof && (
              <a
                className="button"
                href={explorerLink(proof.signature)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Inspect on Solana Explorer ↗
              </a>
            )}
          </section>
          <section className="panel">
            <h3>Canonical achievement record</h3>
            <p className="muted">
              Version {version} uses fixed key order and an ISO UTC timestamp.{" "}
              {version === 1
                ? "Legacy v1 covers achievement, company and challenge identifiers plus issue time. It does not cover recipient, title or evidence."
                : "V2 also commits to recipient, issuer label, title, type, approved submission and a salted evidence digest. Only the final hash is placed onchain."}
            </p>
            <pre className="hash" style={{ whiteSpace: "pre-wrap" }}>
              {serializeRecord(record)}
            </pre>
          </section>
        </div>
        <aside className="panel" style={{ alignSelf: "start" }}>
          <h3>What this proves</h3>
          <p className="muted">
            An onchain hash shows that this record was committed at a point in
            time. It does not independently establish whether the company’s
            assessment was truthful, its legal identity, or the candidate’s
            skill level.
          </p>
          <p className="muted section-spacer">
            Devnet is a testing network and can reset. Company approval and
            blockchain anchoring are separate events.
          </p>
          {a.profiles?.is_public && (
            <div className="section-spacer">
              <ButtonLink secondary href={`/talent/${a.profiles.slug}`}>
                View skill passport
              </ButtonLink>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
