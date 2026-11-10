import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { loadSection } from "@/lib/section-result";
import { HistoryForm } from "@/components/history-form";
import { PassportSectionState } from "@/components/passport-section-state";
import type { HistoryRecord } from "@/lib/profile-history";
export const dynamic = "force-dynamic";
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/sign-in?next=%2Fprofile-history");
  const result = await loadSection<HistoryRecord>(() =>
    db
      .from("passport_history")
      .select(
        "id,kind,organization,title,field,start_date,end_date,ongoing,description,is_public",
      )
      .eq("owner_id", user.id)
      .order("start_date", { ascending: false })
      .abortSignal(AbortSignal.timeout(8000)),
  );
  const { message } = await searchParams;
  return (
    <main className="container section">
      <Link href="/portal/talent/passport">← My Profile</Link>
      <h1>Education & work experience</h1>
      <p className="muted">
        Add your professional background. These records are self-reported,
        separate from organization-issued credentials.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {result.state === "unavailable" ? (
        <PassportSectionState
          title="Your history"
          state="unavailable"
          href="/profile-history"
        />
      ) : (
        <>
          {result.state === "empty" && (
            <p className="muted">
              No records yet. Add your education or first role below.
            </p>
          )}
          {result.items.map((record) => (
            <details className="panel section-spacer" key={record.id}>
              <summary>
                {record.title} · {record.organization} ·{" "}
                {record.is_public
                  ? "Shared when Passport is public"
                  : "Private"}
              </summary>
              <HistoryForm record={record} />
            </details>
          ))}
          <section className="panel section-spacer">
            <h2>Add a record</h2>
            <HistoryForm />
          </section>
        </>
      )}
    </main>
  );
}
