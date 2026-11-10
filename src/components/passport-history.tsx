import { supabase, isConfigured } from "@/lib/supabase/server";
import { loadSection } from "@/lib/section-result";
import type { HistoryRecord } from "@/lib/profile-history";
import { PassportSectionState } from "./passport-section-state";
export async function PassportHistory({
  ownerId,
  preview,
  retryHref,
}: {
  ownerId: string;
  preview: boolean;
  retryHref: string;
}) {
  if (!isConfigured()) return null;
  const db = await supabase();
  const result = await loadSection<HistoryRecord>(() => {
    let query = db
      .from("passport_history")
      .select(
        "id,kind,organization,title,field,start_date,end_date,ongoing,description,is_public",
      )
      .eq("owner_id", ownerId);
    if (!preview) query = query.eq("is_public", true);
    return query
      .order("start_date", { ascending: false })
      .abortSignal(AbortSignal.timeout(8000));
  });
  if (result.state === "unavailable")
    return (
      <PassportSectionState
        title="Education & experience"
        state="unavailable"
        href={retryHref}
      />
    );
  return (
    <>
      {(["education", "employment"] as const).map((kind) => {
        const records = result.items.filter((r) => r.kind === kind);
        const title = kind === "education" ? "Education" : "Work experience";
        return (
          <section className="section-spacer" key={kind}>
            <h2>{title}</h2>
            {!records.length ? (
              <p className="muted">No records shared.</p>
            ) : (
              records.map((r) => (
                <article className="panel section-spacer" key={r.id}>
                  <p className="record-label">
                    SELF-REPORTED{preview && !r.is_public ? " · PRIVATE" : ""}
                  </p>
                  <h3>{r.title}</h3>
                  <p>
                    {r.organization}
                    {r.field ? ` · ${r.field}` : ""}
                  </p>
                  <p className="muted">
                    {r.start_date} — {r.ongoing ? "Present" : r.end_date}
                  </p>
                  {r.description && (
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {r.description}
                    </p>
                  )}
                </article>
              ))
            )}
          </section>
        );
      })}
    </>
  );
}
