import Link from "next/link";
import { PageHeading, Empty, Tags } from "@/components/ui";
import { isConfigured, supabase, currentUser } from "@/lib/supabase/server";
import { projectData } from "@/lib/paid-data";
import { tokenAmount } from "@/lib/payments";
export const dynamic = "force-dynamic";
export default async function PaidProjects({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; message?: string }>;
}) {
  const { view, message } = await searchParams;
  let projects: ReturnType<typeof projectData>[] = [];
  let unavailable = false;
  let signedIn = false;
  if (isConfigured()) {
    const db = await supabase();
    const user = await currentUser();
    signedIn = Boolean(user);
    let query = db
      .from("paid_projects")
      .select("*,companies(name)")
      .order("created_at", { ascending: false });
    if (view === "company" && user) {
      const { data: members } = await db
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", user.id);
      query = query.in(
        "company_id",
        (members ?? []).map((m) => m.company_id),
      );
    } else if (view === "mine" && user) {
      const { data: apps } = await db
        .from("paid_project_applications")
        .select("project_id")
        .eq("worker_id", user.id);
      query = query.in(
        "id",
        (apps ?? []).map((a) => a.project_id),
      );
    } else
      query = query
        .eq("status", "published")
        .gte("deadline", new Date().toISOString().slice(0, 10));
    const { data, error } = await query;
    unavailable = Boolean(error);
    projects = (data ?? []).map(projectData);
  } else unavailable = true;
  return (
    <div className="container page">
      <PageHeading
        eyebrow="PROOFPAK OPPORTUNITIES"
        title={
          view === "company"
            ? "Company paid projects"
            : view === "mine"
              ? "My paid projects"
              : "Optional paid projects"
        }
        description="Build experience through clearly scoped work. Direct payments follow company approval; funds are not locked or guaranteed."
        action={
          signedIn ? (
            <Link className="button" href="/paid-projects/new">
              Create a paid project ↗
            </Link>
          ) : (
            <Link className="button" href="/sign-in">
              Sign in to apply ↗
            </Link>
          )
        }
      />
      <div className="button-row">
        <Link className="text-link" href="/paid-projects">
          Explore projects
        </Link>
        {signedIn && (
          <>
            <Link className="text-link" href="/paid-projects?view=mine">
              My applications and work
            </Link>
            <Link className="text-link" href="/paid-projects?view=company">
              Company projects
            </Link>
            <Link className="text-link" href="/wallet">
              Wallet
            </Link>
          </>
        )}
        <Link className="text-link" href="/challenges">
          Unpaid skill challenges
        </Link>
        <Link className="text-link" href="/portal/talent/passport">
          My passport
        </Link>
      </div>
      <p className="notice section-spacer">
        Solana devnet · test USDC only · not real money. Payment completion does
        not verify someone’s skills or automatically issue a credential.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {unavailable ? (
        <p className="notice">
          Paid projects require the new Supabase migration. No projects or
          payments are being simulated.
        </p>
      ) : !projects.length ? (
        <Empty title="No paid projects here yet">
          Explore skill challenges or continue building your passport with your
          own projects.
        </Empty>
      ) : (
        <div className="challenge-grid section-spacer">
          {projects.map((p) => (
            <Link className="panel" href={`/paid-projects/${p.id}`} key={p.id}>
              <p className="eyebrow">
                {p.companies?.name} · {p.status}
              </p>
              <h2>{p.title}</h2>
              <p className="muted">{p.description.slice(0, 180)}</p>
              <Tags values={p.skills} />
              <p className="section-spacer">
                {tokenAmount(p.budget_units)} test USDC · Due {p.deadline}
              </p>
              <span className="text-link">View scope and milestones ↗</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
