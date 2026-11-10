import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import {
  teamRoleLabels,
  teamInvitationColumns,
  teamInviteStatus,
  teamCan,
} from "@/lib/team-permissions";
import {
  TeamInviteForm,
  TeamMemberForm,
  TeamInvitationDecision,
} from "@/components/team-forms";
import { PassportSectionState } from "@/components/passport-section-state";
export const dynamic = "force-dynamic";
type Workspace = {
  role: string;
  can_manage: boolean;
  total: number;
  event_total: number;
  members: {
    user_id: string | null;
    full_name: string;
    role: string;
    created_at: string;
  }[];
  events: {
    actor: string;
    event_type: string;
    created_at: string;
    details: Record<string, string | null>;
  }[];
};
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; page?: string; message?: string }>;
}) {
  const { db, user } = await credentialWorkspace("/team-invitations");
  const params = await searchParams;
  const { data: members, error } = await db
    .from("company_memberships")
    .select("company_id,role,companies(name)")
    .eq("user_id", user.id);
  if (error)
    return (
      <PassportSectionState
        title="Organization access"
        state="unavailable"
        href="/organization-team"
      />
    );
  const company = params.company ?? members?.[0]?.company_id;
  const member = members?.find((m) => m.company_id === company);
  if (!member)
    return (
      <main className="container page narrow">
        <h1>Organization team</h1>
        <p>
          Choose an organization you belong to, or accept a team invitation.
        </p>
        <Link href="/team-invitations">My team invitations</Link> ·{" "}
        <Link href="/organizations">My organizations</Link>
      </main>
    );
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.page ?? "1") || 1),
  );
  const { data, error: teamError } = await db.rpc(
    "organization_team_workspace",
    { p_company: company, p_page: page },
  );
  if (teamError || !data)
    return (
      <PassportSectionState
        title="Team"
        state="unavailable"
        href={`/organization-team?company=${company}`}
      />
    );
  const team = data as Workspace;
  const invites = team.can_manage
    ? await db
        .from("organization_team_invitations")
        .select(teamInvitationColumns)
        .eq("company_id", company)
        .order("created_at", { ascending: false })
        .range((page - 1) * 20, page * 20 - 1)
    : { data: [], error: null };
  return (
    <main className="container page">
      <Link href={`/portal/company?company=${company}`}>
        ← Organization dashboard
      </Link>
      <h1>Organization team</h1>
      <form className="button-row" action="/organization-team">
        <label>
          Organization
          <select name="company" defaultValue={company}>
            {members?.map((m) => (
              <option key={m.company_id} value={m.company_id}>
                {(m.companies as unknown as { name: string })?.name ??
                  "Organization"}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary">Switch organization</button>
      </form>
      <p>
        Your role: {teamRoleLabels[team.role] ?? team.role}. Only owners and
        administrators manage the team; ordinary members have scoped workflow
        access.
      </p>
      {params.message && (
        <p role="status" className="notice">
          {params.message}
        </p>
      )}
      <div className="button-row">
        {teamCan(team.role, "credentials") && (
          <Link href="/organizations?view=issue">Credentials</Link>
        )}
        {teamCan(team.role, "opportunities") && (
          <Link href={`/portal/company/challenges?company=${company}`}>
            Challenges & opportunities
          </Link>
        )}
        <Link href="/team-invitations">My invitations</Link>
      </div>
      <section className="section-spacer">
        <h2>Members</h2>
        {team.members.map((m, i) => (
          <article className="panel section-spacer" key={m.user_id ?? i}>
            <h3>{m.full_name}</h3>
            <p>
              {teamRoleLabels[m.role]} · Active member · Joined{" "}
              {m.created_at.slice(0, 10)}
            </p>
            {team.can_manage &&
              m.user_id &&
              m.user_id !== user.id &&
              (team.role === "owner" ||
                !["owner", "administrator", "reviewer"].includes(m.role)) && (
                <details>
                  <summary>Manage access</summary>
                  <TeamMemberForm
                    company={company!}
                    member={m.user_id}
                    actorRole={team.role}
                    currentRole={m.role}
                  />
                </details>
              )}
          </article>
        ))}
      </section>
      {team.can_manage && (
        <>
          <details className="panel section-spacer">
            <summary>Invite a team member</summary>
            <TeamInviteForm company={company!} role={team.role} />
          </details>
          <section className="section-spacer">
            <h2>Team invitations</h2>
            {invites.error ? (
              <PassportSectionState
                title="Invitations"
                state="unavailable"
                href={`/organization-team?company=${company}`}
              />
            ) : (
              <>
                {!invites.data?.length && <p>No invitations on this page.</p>}
                {invites.data?.map((i) => (
                  <article key={i.id} className="panel section-spacer">
                    <h3>{i.recipient_email}</h3>
                    <p>
                      {teamRoleLabels[i.proposed_role]} · {teamInviteStatus(i)}{" "}
                      · Expires {i.expires_at.slice(0, 10)}
                    </p>
                    {teamInviteStatus(i) === "pending" &&
                      (team.role === "owner" ||
                        i.proposed_role !== "administrator") && (
                        <TeamInvitationDecision id={i.id} cancel />
                      )}
                  </article>
                ))}
              </>
            )}
            <p className="muted">
              To replace a lost link, cancel the pending invitation and create a
              new one. No email is sent.
            </p>
          </section>
          <section className="section-spacer">
            <h2>Recent team activity</h2>
            <p>
              Only recorded events are shown. Existing credential
              issuance/revocation and opportunity reviews remain in their
              original workspaces.
            </p>
            {!team.events.length && <p>No team events recorded yet.</p>}
            {team.events.map((e, i) => (
              <p key={i}>
                {e.actor} · {e.event_type.replaceAll("_", " ")} ·{" "}
                {new Date(e.created_at).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
                {e.details.resulting_role
                  ? ` · ${teamRoleLabels[e.details.resulting_role]}`
                  : ""}
              </p>
            ))}
          </section>
        </>
      )}
      <nav className="button-row" aria-label="Team pages">
        {page > 1 && (
          <Link href={`?company=${company}&page=${page - 1}`}>Previous</Link>
        )}
        {(page * 20 < team.total ||
          page * 20 < team.event_total ||
          invites.data?.length === 20) && (
          <Link href={`?company=${company}&page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </main>
  );
}
