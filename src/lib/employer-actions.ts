"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { credentialWorkspace } from "./credential-data";
import { messageLink } from "./navigation-message";
import { opportunityReference } from "./employer-discovery";
function fail(path: string, error: { message: string; code?: string } | null) {
  if (error)
    redirect(
      messageLink(
        path,
        error.code === "P0001"
          ? error.message
          : "Could not save. Check your permissions and try again.",
      ),
    );
}
export async function saveDiscoveryPreferences(form: FormData) {
  const { db } = await credentialWorkspace();
  const { error } = await db.rpc("set_discovery_preferences", {
    p_discoverable: form.get("discoverable") === "on",
    p_contact: form.get("contact") === "on",
  });
  fail("/portal/talent/settings", error);
  revalidatePath("/portal");
  redirect(
    messageLink(
      "/portal/talent/settings",
      "Discovery preferences saved. Public sharing is controlled separately.",
    ),
  );
}
export async function saveCandidate(form: FormData) {
  const { db } = await credentialWorkspace();
  const company = z.uuid().parse(form.get("company_id"));
  const candidate = z.uuid().parse(form.get("candidate_id"));
  const path = `/portal/company/directory?company=${company}&saved=1`;
  const { error } = await db.rpc("save_candidate", {
    p_company: company,
    p_candidate: candidate,
    p_note: z
      .string()
      .max(500)
      .parse(form.get("note") ?? ""),
  });
  fail(path, error);
  revalidatePath("/portal/company/directory");
  redirect(
    messageLink(
      path,
      "Candidate saved to this organization’s private shortlist.",
    ),
  );
}
export async function removeCandidate(form: FormData) {
  const { db } = await credentialWorkspace();
  const company = z.uuid().parse(form.get("company_id"));
  const { error } = await db.rpc("remove_saved_candidate", {
    p_company: company,
    p_candidate: z.uuid().parse(form.get("candidate_id")),
  });
  const path = `/portal/company/directory?company=${company}&saved=1`;
  fail(path, error);
  revalidatePath("/portal/company/directory");
  redirect(messageLink(path, "Candidate removed from shortlist."));
}
export async function requestContact(form: FormData) {
  const { db } = await credentialWorkspace();
  const company = z.uuid().parse(form.get("company_id"));
  const path = `/contact-requests?company=${company}&view=outgoing`;
  let ref;
  try {
    ref = opportunityReference(String(form.get("opportunity") ?? ""));
  } catch {
    redirect(messageLink(path, "Choose an existing published opportunity."));
  }
  const { error } = await db.rpc("create_contact_request", {
    p_company: company,
    p_candidate: z.uuid().parse(form.get("candidate_id")),
    p_purpose: z.string().trim().min(20).max(1000).parse(form.get("purpose")),
    p_challenge: ref.challenge,
    p_paid_project: ref.project,
  });
  fail(path, error);
  revalidatePath("/contact-requests");
  redirect(
    messageLink(
      path,
      "Contact request saved. No email or contact details were shared.",
    ),
  );
}
export async function respondContact(form: FormData) {
  const { db } = await credentialWorkspace();
  const { error } = await db.rpc("respond_contact_request", {
    p_request: z.uuid().parse(form.get("request_id")),
    p_decision: z.enum(["accepted", "declined"]).parse(form.get("decision")),
  });
  fail("/contact-requests", error);
  revalidatePath("/contact-requests");
  redirect(
    messageLink(
      "/contact-requests",
      "Your decision was saved. No private contact details were shared.",
    ),
  );
}
