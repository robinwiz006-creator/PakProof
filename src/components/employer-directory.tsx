import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import {
  evidenceDirectoryInput,
  directoryPageHref,
  type CandidateCardData,
} from "@/lib/employer-discovery";
import {
  saveCandidate,
  removeCandidate,
  requestContact,
} from "@/lib/employer-actions";
import { CandidateCard } from "./candidate-card";
import { PassportSectionState } from "./passport-section-state";
import { TalentSearchForm } from "./talent-search-form";
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
  const parsed = evidenceDirectoryInput.safeParse({
    education: params.education,
    experience: params.experience,
    project: params.project,
    category: params.category,
    sort: params.sort,
    opportunity: params.opportunity,
    q: params.q ?? "",
    skill: params.skill ?? "",
    page: params.page ?? 1,
  });
  if (!parsed.success)
    return (
      <p className="notice">
        Use filters under 120 characters, up to ten skills (80 characters each),
        and a valid page.{" "}
        <Link href={`/portal/company/directory?company=${companyId}`}>
          Clear filters
        </Link>
      </p>
    );
  const {
    q,
    skill,
    page,
    education,
    experience,
    project,
    category,
    sort,
    opportunity,
  } = parsed.data;
  const db = await supabase();
  const [result, challenges, projects] = await Promise.all([
    db
      .rpc("search_passports_evidence", {
        p_education: education,
        p_experience: experience,
        p_project: project,
        p_category: category,
        p_sort: sort,
        p_opportunity: opportunity,
        p_completed: params.completed === "1",
        p_company: companyId,
        p_query: q,
        p_skill: skill,
        p_credentials: params.credentials === "1",
        p_assessed: params.assessed === "1",
        p_saved: params.saved === "1",
        p_page: page,
      })
      .abortSignal(AbortSignal.timeout(8000)),
    db
      .from("challenges")
      .select("id,title")
      .eq("company_id", companyId)
      .eq("status", "published")
      .gte("deadline", new Date().toISOString().slice(0, 10))
      .limit(50)
      .abortSignal(AbortSignal.timeout(8000)),
    db
      .from("public_paid_projects")
      .select("id,title")
      .eq("company_id", companyId)
      .eq("status", "published")
      .gte("deadline", new Date().toISOString().slice(0, 10))
      .limit(50)
      .abortSignal(AbortSignal.timeout(8000)),
  ]);
  if (result.error || !result.data)
    return (
      <PassportSectionState
        title="Candidate discovery"
        state="unavailable"
        href={directoryPageHref(companyId, params, page)}
      />
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
          Sent invitations & contact requests
        </Link>
      </div>
      {(challenges.error || projects.error) && (
        <p className="notice" role="status">
          Some opportunity choices could not be loaded. Candidate results remain
          available; reload to retry.
        </p>
      )}
      <TalentSearchForm
        companyId={companyId}
        filters={parsed.data}
        params={params}
        opportunities={opportunities}
      />

      <p className="muted section-spacer">
        {data.total} matching Passports · Page {page}.{" "}
        {sort === "relevance"
          ? "Ordered by requested skills, relevant consented assessed achievements, then matching projects."
          : "Alphabetical order."}{" "}
        These are evidence counts, not skill-quality scores. Public history and
        projects are self-reported; institution trust and credential validity
        are separate.
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
