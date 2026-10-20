import { notFound } from "next/navigation";
import { z } from "zod";
import { isConfigured, supabase, currentUser } from "@/lib/supabase/server";
import { credentialSelect, type Credential } from "@/lib/credentials";
import { checkCredentialAnchor } from "@/lib/credential-solana";
import { credentialIntegrity } from "@/lib/credential-verification";
import { CredentialDetail } from "@/components/credential-detail";
export const dynamic = "force-dynamic";
export default async function CredentialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isConfigured() || !z.uuid().safeParse(id).success) notFound();
  const db = await supabase();
  const { data, error } = await db
    .from("credentials")
    .select(credentialSelect)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const c = data as unknown as Credential;
  const [recipientResult, integrity, user] = await Promise.all([
    db
      .from("profiles")
      .select("full_name,slug,is_public")
      .eq("id", c.recipient_id)
      .maybeSingle(),
    credentialIntegrity(c, checkCredentialAnchor),
    currentUser(),
  ]);
  const { data: recipient, error: recipientError } = recipientResult;
  if (recipientError)
    throw new Error(
      "The recipient details could not be loaded. Please try again.",
    );
  const isRecipient = user?.id === c.recipient_id;
  let isIssuerMember = false;
  if (user && !isRecipient && c.organizations?.company_id) {
    const { data: member } = await db
      .from("company_memberships")
      .select("role")
      .eq("company_id", c.organizations.company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    isIssuerMember = Boolean(member);
  }
  return (
    <div className="container page credential-page">
      <CredentialDetail
        credential={c}
        recipient={recipient}
        integrity={integrity}
        canViewPrivate={isRecipient || isIssuerMember}
        manageHref={
          isRecipient
            ? `/my-credentials#credential-${c.id}`
            : isIssuerMember
              ? "/organizations?view=issued"
              : undefined
        }
        manageLabel={
          isRecipient
            ? "Manage acceptance & visibility"
            : "Manage issued credential"
        }
      />
    </div>
  );
}
