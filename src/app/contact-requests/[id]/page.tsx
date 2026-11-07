import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { credentialWorkspace } from "@/lib/credential-data";
import { sendContactFollowup, closeContact } from "@/lib/employer-actions";
import { ContactHandoff } from "@/components/contact-handoff";
import type { ContactNote, ContactOpportunity } from "@/lib/contact-handoff";
export const dynamic = "force-dynamic";
export default async function ContactDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { db, user } = await credentialWorkspace();
  const { data: r, error } = await db
    .from("visible_contact_requests")
    .select("id,company_id,candidate_id,purpose,status,companies(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Contact request could not be loaded.");
  if (!r) notFound();
  const candidate = r.candidate_id === user.id;
  let profileQuery = db
    .from("profiles")
    .select("full_name,slug,is_public,is_discoverable,allow_contact_requests")
    .eq("id", r.candidate_id);
  if (!candidate)
    profileQuery = profileQuery
      .eq("is_public", true)
      .eq("is_discoverable", true)
      .eq("allow_contact_requests", true);
  const [notes, opportunity, profile] = await Promise.all([
    db
      .from("visible_contact_followups")
      .select("id,sender,topic,body,created_at")
      .eq("request_id", id)
      .order("created_at")
      .order("id")
      .limit(12),
    db.rpc("contact_request_opportunity", { p_request: id }),
    profileQuery.maybeSingle(),
  ]);
  if (notes.error || opportunity.error || profile.error)
    throw new Error("Private follow-up could not be loaded.");
  const p = profile.data;
  if (!p) notFound();
  const consent =
    !candidate ||
    Boolean(p?.is_public && p?.is_discoverable && p?.allow_contact_requests);
  const { message } = await searchParams;
  return (
    <main className="container page narrow">
      <Link
        className="text-link"
        href={
          candidate
            ? "/contact-requests"
            : `/contact-requests?view=outgoing&company=${r.company_id}`
        }
      >
        ← Contact requests
      </Link>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {!candidate && (
        <p className="section-spacer">
          Contact with{" "}
          <Link className="text-link" href={`/talent/${p.slug}`}>
            {p.full_name}
          </Link>
        </p>
      )}
      <ContactHandoff
        id={id}
        organization={
          (r.companies as unknown as { name: string })?.name ?? "Organization"
        }
        purpose={r.purpose}
        status={r.status}
        candidate={candidate}
        consent={consent}
        notes={(notes.data ?? []) as ContactNote[]}
        opportunity={opportunity.data as ContactOpportunity | null}
        nonce={crypto.randomUUID()}
        send={sendContactFollowup}
        close={closeContact}
      />
      {candidate && (
        <Link
          className="text-link section-spacer"
          href="/portal/talent/settings"
        >
          Discovery and contact settings
        </Link>
      )}
      {r.status === "pending" && candidate && (
        <Link className="button secondary" href="/contact-requests">
          Review and accept or decline in your inbox
        </Link>
      )}
    </main>
  );
}
