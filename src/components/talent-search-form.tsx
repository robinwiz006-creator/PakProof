import { credentialTypeLabels } from "@/lib/issuer-permissions";
import type { z } from "zod";
import type { evidenceDirectoryInput } from "@/lib/employer-discovery";
export function TalentSearchForm({
  companyId,
  filters,
  params,
  opportunities,
}: {
  companyId: string;
  filters: z.infer<typeof evidenceDirectoryInput>;
  params: Record<string, string | undefined>;
  opportunities: { value: string; title: string }[];
}) {
  const {
    q,
    skill,
    education,
    experience,
    project,
    category,
    sort,
    opportunity,
  } = filters;
  return (
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
        All requested skills (comma-separated, exact match)
        <input name="skill" defaultValue={skill} maxLength={800} />
      </label>
      <label>
        <input
          type="checkbox"
          name="credentials"
          value="1"
          defaultChecked={params.credentials === "1"}
        />{" "}
        Has a current published organization-issued credential
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
      <details>
        <summary>Education, experience & evidence filters</summary>
        <label className="field">
          Public education
          <input name="education" defaultValue={education} maxLength={120} />
        </label>
        <label className="field">
          Public employment experience
          <input name="experience" defaultValue={experience} maxLength={120} />
        </label>
        <label className="field">
          Public project experience
          <input name="project" defaultValue={project} maxLength={120} />
        </label>
        <label className="field">
          Current credential category
          <select name="category" defaultValue={category}>
            <option value="">Any category</option>
            {Object.entries(credentialTypeLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            name="completed"
            value="1"
            defaultChecked={params.completed === "1"}
          />{" "}
          Has company-approved challenge work
        </label>
        <label className="field">
          Shortlisted for opportunity
          <select name="opportunity" defaultValue={opportunity}>
            <option value="">Any / not grouped</option>
            {opportunities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
      </details>
      <label className="field">
        Sort
        <select name="sort" defaultValue={sort}>
          <option value="name">Name</option>
          <option value="relevance">Public evidence matches</option>
        </select>
      </label>
      <button className="button">Search Passports</button>
    </form>
  );
}
