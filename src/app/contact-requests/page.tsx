import Link from "next/link";
import { contactStatus } from "@/lib/contact-handoff";
import { z } from "zod";
import { credentialWorkspace } from "@/lib/credential-data";
import { respondContact } from "@/lib/employer-actions";
import { PageHeading, Empty } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
export const dynamic = "force-dynamic";
export default async function ContactRequests({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    company?: string;
    message?: string;
    page?: string;
    status?: string;
  }>;
}) {
  const params = await searchParams;
  const { db, user } = await credentialWorkspace();
  const outgoing = params.view === "outgoing";
  const pageResult = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(params.page ?? 1);
  const page = pageResult.success ? pageResult.data : 1;
  const { data: members, error: memberError } = await db
    .from("company_memberships")
    .select("company_id,companies(name)")
    .eq("user_id", user.id);
  if (memberError) throw new Error("Company access could not be loaded.");
  const company = params.company ?? members?.[0]?.company_id;
  if (outgoing && (!company || !members?.some((m) => m.company_id === company)))
    return (
      <div className="container page">
        <Empty title="Company membership required">
          <Link href="/portal/company/profile">
            Create or manage a company profile
          </Link>
          , then choose an organization you belong to. Credential-issuing
          permission is separate.
        </Empty>
      </div>
    );
  let query = db
    .from("visible_contact_requests")
    .select(
      "id,company_id,candidate_id,purpose,status,created_at,responded_at,challenge_id,paid_project_id,companies(name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  query = outgoing
    ? query.eq("company_id", company!)
    : query.eq("candidate_id", user.id);
  const statusFilter =
    params.status &&
    [
      "pending",
      "accepted",
      "declined",
      "expired",
      "closed",
      "withdrawn",
    ].includes(params.status)
      ? params.status
      : "";
  if (statusFilter) query = query.eq("status", statusFilter);
  const { data, error, count } = await query;
  if (error) throw new Error("Contact requests could not be loaded.");
  // Read names only through the directory's current consent gate; never cache a
  // profile snapshot inside a request. UUIDs are not displayed as a public name.
  const today = new Date().toISOString().slice(0, 10);
  const [profilesResult, challengesResult, projectsResult] = await Promise.all([
    outgoing && data?.length
      ? db
          .from("profiles")
          .select("id,full_name,slug")
          .in(
            "id",
            data.map((r) => r.candidate_id),
          )
          .eq("is_public", true)
          .eq("is_discoverable", true)
          .eq("allow_contact_requests", true)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("challenges")
      .select("id")
      .in(
        "id",
        (data ?? []).flatMap((r) => (r.challenge_id ? [r.challenge_id] : [])),
      )
      .eq("status", "published")
      .gte("deadline", today),
    db
      .from("public_paid_projects")
      .select("id")
      .in(
        "id",
        (data ?? []).flatMap((r) =>
          r.paid_project_id ? [r.paid_project_id] : [],
        ),
      )
      .eq("status", "published")
      .gte("deadline", today),
  ]);
  if (profilesResult.error || challengesResult.error || projectsResult.error)
    throw new Error(
      "Candidate or opportunity visibility could not be checked.",
    );
  const names = new Map(
    (profilesResult.data ?? []).map((p) => [
      p.id,
      { name: p.full_name, slug: p.slug },
    ]),
  );
  const openChallenges = new Set(
    (challengesResult.data ?? []).map((c) => c.id),
  );
  const openProjects = new Set((projectsResult.data ?? []).map((p) => p.id));
  const href = (n: number) =>
    `/contact-requests?${new URLSearchParams({ ...(outgoing ? { view: "outgoing", company: company! } : {}), ...(statusFilter ? { status: statusFilter } : {}), page: String(n) })}`;
  return (
    <div className="container page">
      <PageHeading
        title="Contact & opportunity invitations"
        description="Review requests and agree on a next step privately. No email or phone is shared automatically."
      />
      <form action="/contact-requests" className="button-row">
        <input type="hidden" name="view" value={outgoing ? "outgoing" : ""} />
        {outgoing && <input type="hidden" name="company" value={company} />}
        <label>
          Status
          <select name="status" defaultValue={statusFilter}>
            <option value="">All</option>
            {[
              "pending",
              "accepted",
              "declined",
              "expired",
              "closed",
              "withdrawn",
            ].map((s) => (
              <option key={s} value={s}>
                {contactStatus(s)}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary">Filter invitations</button>
      </form>
      <div className="button-row">
        <Link className="text-link" href="/contact-requests">
          Incoming requests
        </Link>
        {members?.length ? (
          <Link
            className="text-link"
            href={`/contact-requests?view=outgoing&company=${company}`}
          >
            Sent requests
          </Link>
        ) : null}
        <Link className="text-link" href="/portal/talent/settings">
          Discovery settings
        </Link>
      </div>
      {outgoing && (
        <form action="/contact-requests" className="section-spacer">
          <input type="hidden" name="view" value="outgoing" />
          <label className="field">
            Organization
            <select name="company" defaultValue={company}>
              {members?.map((m) => (
                <option value={m.company_id} key={m.company_id}>
                  {(m.companies as unknown as { name: string })?.name}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary">Switch organization</button>
        </form>
      )}
      {params.message && (
        <p className="notice section-spacer" role="status">
          {params.message}
        </p>
      )}
      {!data?.length ? (
        <Empty
          title={
            outgoing ? "No available sent requests" : "No incoming requests"
          }
        >
          Requests appear here after an organization sends one. Private or
          opted-out candidates are hidden from company views.
        </Empty>
      ) : (
        data.map((r) => (
          <article className="panel section-spacer" key={r.id}>
            <div className="list-row">
              <h2>
                {outgoing
                  ? (names.get(r.candidate_id)?.name ?? "Candidate unavailable")
                  : ((r.companies as unknown as { name: string })?.name ??
                    "Organization")}
              </h2>
              <span className="tag">{contactStatus(r.status)}</span>
            </div>
            <p>{r.purpose}</p>
            <p className="muted">
              Sent {r.created_at.slice(0, 10)} · Organization registration is
              separate from ProofPak credential-issuer approval.
            </p>
            {outgoing && names.get(r.candidate_id) && (
              <Link
                className="text-link"
                href={`/talent/${names.get(r.candidate_id)!.slug}`}
              >
                View Passport ↗
              </Link>
            )}
            {r.challenge_id && openChallenges.has(r.challenge_id) && (
              <Link
                className="text-link"
                href={`/challenges/${r.challenge_id}`}
              >
                View linked challenge ↗
              </Link>
            )}
            {r.paid_project_id && openProjects.has(r.paid_project_id) && (
              <Link
                className="text-link"
                href={`/paid-projects/${r.paid_project_id}`}
              >
                View linked paid project (devnet test tokens) ↗
              </Link>
            )}
            {((r.challenge_id && !openChallenges.has(r.challenge_id)) ||
              (r.paid_project_id && !openProjects.has(r.paid_project_id))) && (
              <p className="muted">
                The linked opportunity is no longer open or publicly available.
              </p>
            )}
            {!outgoing && r.status === "pending" && (
              <form className="section-spacer" action={respondContact}>
                <input type="hidden" name="request_id" value={r.id} />
                <label className="field">
                  Your decision
                  <select name="decision" defaultValue="" required>
                    <option value="">Choose a decision</option>
                    <option value="accepted">
                      {r.challenge_id || r.paid_project_id
                        ? "Accept opportunity invitation"
                        : "Accept contact request"}
                    </option>
                    <option value="declined">Decline request</option>
                  </select>
                </label>
                <SubmitButton>Save my decision</SubmitButton>
              </form>
            )}
            <div className="button-row section-spacer">
              <Link
                className="button secondary"
                href={`/contact-requests/${r.id}`}
              >
                {r.status === "accepted"
                  ? "Continue privately"
                  : "View request & history"}
              </Link>
            </div>
            {r.status === "pending" && (
              <p className="muted">
                Accepting does not apply, award work or create a payment. It
                allows a limited private follow-up with this organization. You
                can close contact at any time. No email or phone is shared.
              </p>
            )}
          </article>
        ))
      )}
      <nav
        className="button-row section-spacer"
        aria-label="Contact request pages"
      >
        {page > 1 && <Link href={href(page - 1)}>Previous page</Link>}
        {page * 20 < (count ?? 0) && (
          <Link href={href(page + 1)}>Next page</Link>
        )}
      </nav>
    </div>
  );
}
