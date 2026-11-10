import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { teamRoleLabels } from "@/lib/team-permissions";
import { PassportSectionState } from "@/components/passport-section-state";
export const dynamic = "force-dynamic";
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; message?: string }>;
}) {
  const { db } = await credentialWorkspace("/team-invitations");
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.page ?? "1") || 1),
  );
  const { data, error } = await db
    .from("my_team_invitations")
    .select("id,company_id,proposed_role,status,expires_at,companies(name)")
    .order("expires_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  return (
    <main className="container page narrow">
      <h1>My team invitations</h1>
      <p>
        Review invitations for your verified email. Joining a team does not
        publish your Passport.
      </p>
      {params.message && (
        <p className="notice" role="status">
          {params.message}
        </p>
      )}
      {error ? (
        <PassportSectionState
          title="Team invitations"
          state="unavailable"
          href="/team-invitations"
        />
      ) : (
        <>
          {!data?.length && (
            <p>
              No invitations on this page. Confirm the intended email address
              first.
            </p>
          )}
          {data?.map((i) => (
            <article className="panel section-spacer" key={i.id}>
              <h2>
                {(i.companies as unknown as { name: string })?.name ??
                  "Organization"}
              </h2>
              <p>
                {teamRoleLabels[i.proposed_role]} · {i.status}
              </p>
              <Link className="button" href={`/team-invitations/${i.id}`}>
                Review invitation
              </Link>
            </article>
          ))}
          <nav className="button-row">
            {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
            {data?.length === 20 && (
              <Link href={`?page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </>
      )}
      <Link href="/organization-team">My organizations & team</Link>
    </main>
  );
}
