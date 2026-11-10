import Link from "next/link";
import { authHref } from "@/lib/auth-navigation";
import { supabase, isConfigured } from "@/lib/supabase/server";
import {
  teamInvitationColumns,
  teamInviteStatus,
  teamRoleLabels,
  teamRoleDescriptions,
} from "@/lib/team-permissions";
import { TeamInvitationDecision } from "@/components/team-forms";
import { PassportSectionState } from "@/components/passport-section-state";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };
export default async function Review({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const next = `/team-invitations/${reference}`;
  const db = isConfigured() ? await supabase() : null;
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user)
    return (
      <main className="container page narrow">
        <h1>Join an organization on ProofPak</h1>
        <p>
          Sign in or create an account with the invited email to review this
          private team invitation. No wallet is required.
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
    const result = await db!.rpc("resolve_team_invitation", {
      p_token: reference,
    });
    if (result.error)
      return (
        <PassportSectionState
          title="Team invitation"
          state="unavailable"
          href={next}
        />
      );
    id = result.data ?? "";
  }
  if (!/^[a-f0-9-]{36}$/.test(id))
    return (
      <main className="container page narrow">
        <h1>Invitation unavailable</h1>
        <p>
          Use the intended verified email account. Ask the owner for a new link
          if needed.
        </p>
        <Link href="/team-invitations">My invitations</Link>
      </main>
    );
  const result = await db!
    .from("organization_team_invitations")
    .select(teamInvitationColumns)
    .eq("id", id)
    .maybeSingle();
  if (result.error)
    return (
      <PassportSectionState
        title="Team invitation"
        state="unavailable"
        href={next}
      />
    );
  const i = result.data;
  if (!i)
    return (
      <main className="container page narrow">
        <h1>Invitation unavailable</h1>
        <p>
          Confirm the invited email and sign in with that account. Private team
          details are not disclosed to other accounts.
        </p>
        <Link href="/team-invitations">My invitations</Link>
      </main>
    );
  const { data: company } = await db!
    .from("companies")
    .select("name")
    .eq("id", i.company_id)
    .maybeSingle();
  const status = teamInviteStatus(i);
  const recipient =
    user.email_confirmed_at && user.email?.toLowerCase() === i.recipient_email;
  return (
    <main className="container page narrow">
      <h1>{company?.name ?? "Organization name unavailable"}</h1>
      <h2>Invitation to join as {teamRoleLabels[i.proposed_role]}</h2>
      <p>{teamRoleDescriptions[i.proposed_role]}</p>
      <p>
        {status} · Expires {i.expires_at.slice(0, 10)}
      </p>
      <p>
        Accepting gives the stated organization access. It does not publish your
        Passport or grant issuer-category approval.
      </p>
      {recipient && status === "pending" && <TeamInvitationDecision id={id} />}
      <Link
        className="button secondary"
        href={
          status === "accepted"
            ? `/organization-team?company=${i.company_id}`
            : "/team-invitations"
        }
      >
        {status === "accepted"
          ? "Open organization team"
          : "My team invitations"}
      </Link>
    </main>
  );
}
