import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import {
  InvitationForm,
  InvitationDecision,
} from "@/components/invitation-form";
import {
  invitationColumns,
  invitationStatus,
  type Invitation,
} from "@/lib/invitations";
import { PassportSectionState } from "@/components/passport-section-state";
export const dynamic = "force-dynamic";
export default async function Invitations({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; message?: string }>;
}) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/sign-in?next=%2Fcredential-invitations");
  const params = await searchParams;
  const page = Math.max(
    0,
    Math.min(10000, Number.parseInt(params.page ?? "0") || 0),
  );
  const [members, result] = await Promise.all([
    db.from("company_memberships").select("company_id").eq("user_id", user.id),
    db
      .from("credential_invitations")
      .select(invitationColumns)
      .order("created_at", { ascending: false })
      .range(page * 20, page * 20 + 19)
      .abortSignal(AbortSignal.timeout(8000)),
  ]);
  const companyIds = members.data?.map((m) => m.company_id) ?? [];
  const orgs = companyIds.length
    ? await db
        .from("organizations")
        .select("id,company_id,issuer_status,allowed_credential_types")
        .in("company_id", companyIds)
    : { data: [], error: null };
  const companies = companyIds.length
    ? await db.from("companies").select("id,name").in("id", companyIds)
    : { data: [], error: null };
  const allowed = (orgs.data ?? [])
    .filter(
      (o) =>
        o.issuer_status === "authorized" && o.allowed_credential_types?.length,
    )
    .map((o) => ({
      id: o.id,
      name:
        companies.data?.find((c) => c.id === o.company_id)?.name ??
        "Organization",
      types: o.allowed_credential_types as string[],
    }));
  return (
    <main className="container page narrow">
      <Link href="/my-credentials">My Credentials</Link> ·{" "}
      <Link href="/organizations">Organizations</Link>
      <h1>Credential invitations</h1>
      <p>
        Review invitations for your verified email. Accepted credentials stay
        private until you choose to share them.
      </p>
      {params.message && (
        <p className="notice" role="status">
          {params.message}
        </p>
      )}
      {result.error ? (
        <PassportSectionState
          title="Invitations"
          state="unavailable"
          href="/credential-invitations"
        />
      ) : (
        <section>
          <h2>Your invitations</h2>
          {!result.data?.length && (
            <p>
              No invitations on this page. Use the email account the issuer
              invited and confirm your email first.
            </p>
          )}
          {((result.data as unknown as Invitation[]) ?? []).map((i) => (
            <article className="panel section-spacer" key={i.id}>
              <h3>{i.title}</h3>
              <p>
                {i.recipient_email} · {invitationStatus(i)} · Created{" "}
                {i.created_at.slice(0, 10)}
              </p>
              <Link className="button" href={`/credential-invitations/${i.id}`}>
                Review invitation
              </Link>
              {invitationStatus(i) === "pending" &&
                orgs.data?.some((o) => o.id === i.organization_id) && (
                  <InvitationDecision id={i.id} cancel />
                )}
            </article>
          ))}
          <nav className="button-row" aria-label="Invitation pages">
            {page > 0 && <Link href={`?page=${page - 1}`}>Previous</Link>}
            {result.data?.length === 20 && (
              <Link href={`?page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </section>
      )}
      {members.error || orgs.error || companies.error ? (
        <PassportSectionState
          title="Issuer access"
          state="unavailable"
          href="/credential-invitations"
        />
      ) : allowed.length > 0 ? (
        <details className="panel section-spacer">
          <summary>Create a credential invitation</summary>
          <InvitationForm organizations={allowed} />
        </details>
      ) : (
        <p className="muted">
          Creating invitations requires organization membership and explicit
          approval for the credential category.
        </p>
      )}
    </main>
  );
}
