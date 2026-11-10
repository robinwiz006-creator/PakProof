import Link from "next/link";
import { isConfigured, supabase } from "@/lib/supabase/server";
import { authHref } from "@/lib/auth-navigation";
import {
  invitationColumns,
  invitationStatus,
  type Invitation,
} from "@/lib/invitations";
import { InvitationDecision } from "@/components/invitation-form";
import { PassportSectionState } from "@/components/passport-section-state";
export const metadata = { referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";
export default async function Review({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const next = `/credential-invitations/${reference}`;
  const db = isConfigured() ? await supabase() : null;
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user)
    return (
      <main className="container page narrow">
        <h1>A credential invitation</h1>
        <p>
          ProofPak brings your skills, work and credentials into one
          professional profile. Sign in with the invited email to review this
          credential privately. No wallet is needed.
        </p>
        <div className="button-row">
          <Link className="button" href={authHref("/sign-in", next)}>
            Sign in to review
          </Link>
          <Link className="button secondary" href={authHref("/sign-up", next)}>
            Create an account
          </Link>
        </div>
      </main>
    );
  let id = reference;
  if (/^[a-f0-9]{64}$/.test(reference)) {
    const resolved = await db!.rpc("resolve_credential_invitation", {
      p_token: reference,
    });
    if (resolved.error)
      return (
        <PassportSectionState
          title="Invitation"
          state="unavailable"
          href={next}
        />
      );
    id = resolved.data ?? "";
  }
  if (!/^[a-f0-9-]{36}$/.test(id))
    return (
      <main className="container page narrow">
        <h1>Invitation unavailable</h1>
        <p>
          Use the intended verified email account. This link may be invalid. Ask
          the issuer for help.
        </p>
        <Link href="/credential-invitations">My invitations</Link>
      </main>
    );
  const result = await db!
    .from("credential_invitations")
    .select(invitationColumns)
    .eq("id", id)
    .maybeSingle();
  if (result.error)
    return (
      <PassportSectionState
        title="Invitation"
        state="unavailable"
        href={next}
      />
    );
  const i = result.data as Invitation | null;
  if (!i)
    return (
      <main className="container page narrow">
        <h1>Invitation unavailable</h1>
        <p>
          Sign in with the intended email and confirm it first. Ask the issuer
          to check the invitation if it remains unavailable.
        </p>
        <Link href="/credential-invitations">My invitations</Link>
      </main>
    );
  const { data: o } = await db!
    .from("organizations")
    .select("company_id")
    .eq("id", i.organization_id)
    .maybeSingle();
  const { data: company } = o
    ? await db!
        .from("companies")
        .select("name")
        .eq("id", o.company_id)
        .maybeSingle()
    : { data: null };
  const status = invitationStatus(i);
  const recipient =
    user.email_confirmed_at && user.email?.toLowerCase() === i.recipient_email;
  return (
    <main className="container page narrow">
      <Link href="/credential-invitations">← Invitations</Link>
      <h1>{i.title}</h1>
      <p>
        {i.status === "accepted" ? "Issued by" : "Prepared by"}{" "}
        {company?.name ?? "Organization name unavailable"}
      </p>
      <p>
        {i.credential_type.replaceAll("_", " ")} · {status}
      </p>
      <p>{i.description}</p>
      <p>
        Issue date: {i.issue_date}
        {i.expiry_date ? ` · Expires: ${i.expiry_date}` : ""}
      </p>
      {i.program_name && <p>Program: {i.program_name}</p>}
      {i.award && <p>Award: {i.award}</p>}
      {i.evidence_url && (
        <a href={i.evidence_url} rel="noreferrer noopener" target="_blank">
          Supporting evidence
        </a>
      )}
      <p>
        Invitation expires {i.expires_at.slice(0, 10)}. Accepting does not
        publish your credential or Passport.
      </p>
      {status === "pending" && recipient && <InvitationDecision id={i.id} />}{" "}
      {status === "accepted" && (
        <Link className="button" href="/my-credentials">
          View credentials and publication settings
        </Link>
      )}
    </main>
  );
}
