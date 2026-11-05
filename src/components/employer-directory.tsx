import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import {
  directoryInput,
  directoryPageHref,
  type CandidateCardData,
} from "@/lib/employer-discovery";
import {
  saveCandidate,
  removeCandidate,
  requestContact,
} from "@/lib/employer-actions";
import { CandidateCard } from "./candidate-card";
import { Empty } from "./ui";
export async function EmployerDirectory({
  companyId,
  params,
}: {
  companyId: string | null;
  params: Record<string, string | undefined>;
}) {
  if (!companyId)
    return (
      <Empty title="Choose an organization first">
        <Link className="text-link" href="/portal/company/profile">
          Create or manage your company profile
        </Link>
        . Company members can search Passports whose owners opted into
        discovery. Credential issuer approval is not required.
      </Empty>
    );
  const parsed = directoryInput.safeParse({
    q: params.q ?? "",
    skill: params.skill ?? "",
    page: params.page ?? 1,
  });
  if (!parsed.success)
    return (
      <p className="notice">
        Use a search under 120 characters, a skill under 80 characters, and a
        valid page.{" "}
        <Link href={`/portal/company/directory?company=${companyId}`}>
          Clear filters
        </Link>
      </p>
    );
  const { q, skill, page } = parsed.data;
  const db = await supabase();
  const [result, challenges, projects] = await Promise.all([
    db.rpc("search_passports", {
      p_company: companyId,
      p_query: q,
      p_skill: skill,
      p_credentials: params.credentials === "1",
      p_assessed: params.assessed === "1",
      p_saved: params.saved === "1",
      p_page: page,
    }),
    db
      .from("challenges")
      .select("id,title")
      .eq("company_id", companyId)
      .eq("status", "published")
      .gte("deadline", new Date().toISOString().slice(0, 10))
      .limit(50),
    db
      .from("public_paid_projects")
      .select("id,title")
      .eq("company_id", companyId)
      .eq("status", "published")
      .gte("deadline", new Date().toISOString().slice(0, 10))
      .limit(50),
  ]);
  if (result.error || challenges.error || projects.error)
    throw new Error(
      "Employer discovery could not be loaded. Check your membership and database setup.",
    );
  const data = result.data as {
    items: CandidateCardData[];
    total: number;
    page: number;
    page_size: number;
  };
  const opportunities = [
    ...(challenges.data ?? []).map((c) => ({
      value: `challenge:${c.id}`,
      title: `Challenge: ${c.title}`,
    })),
    ...(projects.data ?? []).map((p) => ({
      value: `project:${p.id}`,
      title: `Paid project (devnet): ${p.title}`,
    })),
  ];
  return (
    <>
      <div className="button-row">
        <Link
          className="text-link"
          href={`/portal/company/directory?company=${companyId}`}
        >
          Find candidates
        </Link>
        <Link
          className="text-link"
          href={`/portal/company/directory?company=${companyId}&saved=1`}
        >
          Private shortlist
        </Link>
        <Link
          className="text-link"
          href={`/contact-requests?company=${companyId}&view=outgoing`}
        >
          Sent contact requests
        </Link>
      </div>
      <form
        className="panel form section-spacer"
        action="/portal/company/directory"
      >
        <input type="hidden" name="company" value={companyId} />
        {params.saved === "1" && <input type="hidden" name="saved" value="1" />}
        <label className="field">
          Name, headline or project
          <input name="q" defaultValue={q} maxLength={120} />
        </label>
        <label className="field">
          Skill (exact match)
          <input name="skill" defaultValue={skill} maxLength={80} />
        </label>
        <label>
          <input
            type="checkbox"
            name="credentials"
            value="1"
            defaultChecked={params.credentials === "1"}
          />{" "}
          Has published credentials
        </label>
        <label>
          <input
            type="checkbox"
            name="assessed"
            value="1"
            defaultChecked={params.assessed === "1"}
          />{" "}
          Has a published assessed-work summary
        </label>
        <button className="button">Search Passports</button>
      </form>
      <p className="muted section-spacer">
        {data.total} matching Passports · Page {page}. Alphabetical order, not a
        skill ranking. Only directory opt-ins are shown. Credentials may be
        expired or revoked; inspect each record.
      </p>
      {!data.items.length ? (
        <Empty
          title={
            params.saved === "1"
              ? "No available saved candidates"
              : "No matching discoverable Passports"
          }
        >
          Try fewer filters. Private or opted-out candidates are not listed;
          saved notes do not preserve their profile content.
        </Empty>
      ) : (
        data.items.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            companyId={companyId}
            opportunities={opportunities}
            save={saveCandidate}
            remove={removeCandidate}
            contact={requestContact}
          />
        ))
      )}
      <nav
        className="button-row section-spacer"
        aria-label="Candidate result pages"
      >
        {page > 1 && (
          <Link
            className="button secondary"
            href={directoryPageHref(companyId, params, page - 1)}
          >
            Previous page
          </Link>
        )}
        {page * 20 < data.total && (
          <Link
            className="button secondary"
            href={directoryPageHref(companyId, params, page + 1)}
          >
            Next page
          </Link>
        )}
      </nav>
    </>
  );
}
