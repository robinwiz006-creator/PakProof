import { isConfigured, supabase } from "@/lib/supabase/server";
import { Tags } from "./ui";
export async function PassportPaidWork({
  recipientId,
  preview = false,
}: {
  recipientId: string;
  preview?: boolean;
}) {
  if (!isConfigured()) return null;
  const db = await supabase();
  const { data, error } = await db
    .from("paid_work_history")
    .select("*,paid_work_evidence(evidence)")
    .eq("worker_id", recipientId)
    .order("completed_at", { ascending: false });
  if (error) return null;
  const records = (data ?? []).filter(
    (h) => preview || (h.is_public && h.company_consent),
  );
  if (!records.length) return null;
  return (
    <section id="work-history" className="section-spacer">
      <h2>Completed work</h2>
      <p className="muted">
        Company-reviewed delivery from completed paid projects. Payment
        completion is separate from skill credentials; amounts and private
        agreements are not shown here.
      </p>
      {records.map((h) => (
        <article className="panel section-spacer" key={h.project_id}>
          <p className="eyebrow">WORK HISTORY · COMPLETED</p>
          <h3>{h.title}</h3>
          <p>
            {h.company_name} · Completed {h.completed_at.slice(0, 10)}
          </p>
          <p>{h.work_description}</p>
          <Tags values={h.skills} />
          {h.recipient_summary && (
            <>
              <p className="record-label section-spacer">
                RECIPIENT’S OWN SUMMARY
              </p>
              <p>{h.recipient_summary}</p>
            </>
          )}
          {preview && (!h.is_public || !h.company_consent) && (
            <p className="notice">
              Private preview.{" "}
              {h.is_public
                ? "Awaiting company disclosure consent."
                : "You have not chosen to publish this work."}
            </p>
          )}
          <details className="section-spacer">
            <summary>Approved deliverables</summary>
            {(h.deliverables as { title: string; deliverables: string }[]).map(
              (d, i) => (
                <p key={i}>
                  {d.title}: {d.deliverables}
                </p>
              ),
            )}
          </details>
          {h.share_evidence && h.paid_work_evidence?.evidence && (
            <div className="section-spacer">
              {(
                h.paid_work_evidence.evidence as {
                  title: string;
                  explanation: string;
                  evidence_url: string;
                }[]
              ).map((e, i) => (
                <div key={i}>
                  <h4>{e.title}</h4>
                  <p>{e.explanation}</p>
                  <a
                    className="text-link"
                    href={e.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Approved work evidence ↗
                  </a>
                </div>
              ))}
            </div>
          )}
          <p className="muted section-spacer">
            Company names may be self-registered. This work record is not an
            organization-issued skill credential.
          </p>
        </article>
      ))}
    </section>
  );
}
