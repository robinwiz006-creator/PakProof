import { loadSection } from "@/lib/section-result";
import { PassportSectionState } from "./passport-section-state";
import { isConfigured, supabase } from "@/lib/supabase/server";
import { credentialSelect, type Credential } from "@/lib/credentials";
import { CredentialRecord } from "./credential-record";
export async function PassportCredentials({
  recipientId,
  preview = false,
  retryHref,
}: {
  recipientId: string;
  preview?: boolean;
  retryHref?: string;
}) {
  if (!isConfigured()) return null;
  const db = await supabase();
  const result = await loadSection<Credential>(() =>
    db
      .from("credentials")
      .select(credentialSelect)
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .abortSignal(AbortSignal.timeout(8000)),
  );
  if (result.state === "unavailable")
    return (
      <PassportSectionState
        title="Credentials"
        state="unavailable"
        href={retryHref}
      />
    );
  const records = result.items.filter(
    (c) =>
      c.credential_preferences?.acceptance === "accepted" &&
      (preview || c.credential_preferences.is_public),
  );
  if (!records.length)
    return <PassportSectionState title="Credentials" state="empty" />;
  return (
    <section id="credentials" className="section-spacer">
      <h2>Credentials</h2>
      <p className="muted">
        Issued by organizations after an administrator authorization review.
        Separate from self-reported information and company challenge
        achievements.
      </p>
      {records.map((c) => (
        <CredentialRecord key={c.id} credential={c} />
      ))}
    </section>
  );
}
