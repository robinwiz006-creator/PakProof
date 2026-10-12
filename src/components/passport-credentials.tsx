import { isConfigured, supabase } from "@/lib/supabase/server";
import { credentialSelect, type Credential } from "@/lib/credentials";
import { CredentialRecord } from "./credential-record";
export async function PassportCredentials({
  recipientId,
  preview = false,
}: {
  recipientId: string;
  preview?: boolean;
}) {
  if (!isConfigured()) return null;
  const db = await supabase();
  const { data, error } = await db
    .from("credentials")
    .select(credentialSelect)
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
  if (error) return null;
  const records = ((data as unknown as Credential[]) ?? []).filter(
    (c) =>
      c.credential_preferences.acceptance === "accepted" &&
      (preview || c.credential_preferences.is_public),
  );
  if (!records.length) return null;
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
