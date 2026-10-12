import Link from "next/link";
import {
  credentialClaim,
  credentialHash,
  credentialEvidenceDigest,
} from "@/lib/credential-proof";
import { checkCredentialAnchor } from "@/lib/credential-solana";
import { verificationState, verificationLabels } from "@/lib/proof-status";
import { explorerLink } from "@/lib/proof";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeading } from "@/components/ui";
import { isConfigured, supabase } from "@/lib/supabase/server";
import {
  credentialSelect,
  credentialValidity,
  type Credential,
} from "@/lib/credentials";
export const dynamic = "force-dynamic";
export default async function CredentialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isConfigured() || !z.uuid().safeParse(id).success) notFound();
  const db = await supabase();
  const { data, error } = await db
    .from("credentials")
    .select(credentialSelect)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const c = data as unknown as Credential;
  const { data: recipient } = await db
    .from("profiles")
    .select("full_name,slug,is_public")
    .eq("id", c.recipient_id)
    .maybeSingle();
  const shared =
    c.credential_preferences.acceptance === "accepted" &&
    c.credential_preferences.is_public &&
    recipient?.is_public;
  const proof = c.credential_proofs?.[0];
  const hash = await credentialHash(credentialClaim(c));
  const evidenceMatches =
    !c.credential_evidence ||
    (await credentialEvidenceDigest(c.credential_evidence)) ===
      c.evidence_digest;
  let checked: Awaited<ReturnType<typeof checkCredentialAnchor>> | undefined,
    networkError = false;
  if (proof && proof.record_hash === hash && evidenceMatches) {
    try {
      checked = await checkCredentialAnchor(
        proof.signature,
        hash,
        proof.issuer_wallet,
      );
    } catch {
      networkError = true;
    }
  }
  const proofState = verificationState({
    stored: Boolean(proof),
    hashMatches: Boolean(proof?.record_hash === hash && evidenceMatches),
    checked,
    networkError,
  });
  return (
    <div className="container page narrow">
      <PageHeading
        eyebrow="ORGANIZATION-ISSUED CREDENTIAL"
        title={c.title}
        description={c.description}
      />
      {!shared && (
        <p className="notice">
          Private record · visible only to its recipient and issuing
          organization. This link does not publish the credential.
        </p>
      )}
      <dl className="panel">
        <dt>Credential type</dt>
        <dd>{c.credential_type.replaceAll("_", " ")}</dd>
        <dt>Recipient</dt>
        <dd>{recipient?.full_name ?? "Private recipient"}</dd>
        <dt>Issuing organization</dt>
        <dd>{c.issuer_name}</dd>
        <dt>Issuer authorization now</dt>
        <dd>{c.organizations?.issuer_status ?? "Unverified"}</dd>
        <dt>Authorization reference at issuance</dt>
        <dd className="hash">{c.authorization_id}</dd>
        <dt>Credential ID</dt>
        <dd className="hash">{c.id}</dd>
        <dt>Issue date</dt>
        <dd>{c.issue_date}</dd>
        <dt>Expiry</dt>
        <dd>{c.expiry_date ?? "No expiry specified"}</dd>
        <dt>Credential validity</dt>
        <dd>{credentialValidity(c)}</dd>
        <dt>Recipient decision</dt>
        <dd>{c.credential_preferences.acceptance}</dd>
        {c.program_name && (
          <>
            <dt>Program / event</dt>
            <dd>{c.program_name}</dd>
          </>
        )}
        {c.award && (
          <>
            <dt>Award</dt>
            <dd>{c.award}</dd>
          </>
        )}
      </dl>
      {c.credential_events.map((e) => (
        <p key={e.created_at} className="notice">
          Revoked on {e.created_at.slice(0, 10)}: {e.reason}
        </p>
      ))}
      {c.credential_evidence?.evidence_url && (
        <section className="panel section-spacer">
          <h2>Supporting evidence</h2>
          <a
            className="text-link"
            href={c.credential_evidence.evidence_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open evidence ↗
          </a>
        </section>
      )}
      <section className="panel section-spacer">
        <h2>Blockchain integrity</h2>
        <p className="tag">{verificationLabels[proofState]}</p>
        <p className="muted">
          Solana devnet · v3 organization credential claim
        </p>
        {proof && (
          <a
            className="text-link"
            href={explorerLink(proof.signature)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Inspect recorded transaction ↗
          </a>
        )}
        {!c.credential_evidence && (
          <p className="muted">
            Evidence is private. This check covers the committed evidence
            digest, but you cannot inspect its contents.
          </p>
        )}
        <p className="muted">
          Issuer authorization, credential validity, and a matching blockchain
          record are separate checks. A transaction cannot independently prove
          the claim is truthful.
        </p>
      </section>
      {shared && recipient && (
        <Link
          className="text-link section-spacer"
          href={`/talent/${recipient.slug}`}
        >
          View recipient’s skill passport ↗
        </Link>
      )}
      <div className="button-row section-spacer">
        <Link className="text-link" href="/my-credentials">
          My credentials
        </Link>
        <Link className="text-link" href="/organizations">
          Organization workspace
        </Link>
      </div>
    </div>
  );
}
