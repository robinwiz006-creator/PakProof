"use server";
import { messageLink } from "./navigation-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase, isConfigured } from "./supabase/server";
import { credentialInput, organizationTypes } from "./credentials";
function go(path: string, message: string): never {
  redirect(messageLink(path, message));
}
async function context() {
  if (!isConfigured())
    go("/sign-in", "Connect Supabase to use real credentials.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  return db;
}
function parse<T>(schema: z.ZodType<T>, form: FormData, path: string): T {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) go(path, parsed.error.issues[0].message);
  return parsed.data;
}
function result(error: { message: string } | null, path: string) {
  if (error)
    go(
      path,
      "Could not save. Check your details and organization approval, or ask an organization owner to check your access. No change was made.",
    );
  revalidatePath("/organizations");
  revalidatePath("/my-credentials");
  revalidatePath("/talent", "layout");
}
export async function registerOrganization(form: FormData) {
  const path = "/organizations?view=register";
  const v = parse(
    z.object({
      organization_type: z.enum(organizationTypes),
      name: z.string().trim().min(2).max(120),
      description: z.string().trim().min(20).max(4000),
      website: z.union([
        z.literal(""),
        z.url().refine((v) => /^https?:\/\//.test(v)),
      ]),
      company_id: z.union([z.literal(""), z.uuid()]),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("register_organization", {
    p_type: v.organization_type,
    p_name: v.name,
    p_description: v.description,
    p_website: v.website,
    p_company_id: v.company_id || null,
  });
  result(error, path);
  go(
    "/organizations?view=overview",
    "Organization created. An administrator must review your identity before credential issuance is enabled.",
  );
}
export async function issueCredential(form: FormData) {
  const path = "/organizations?view=issue";
  const v = parse(credentialInput, form, path);
  const db = await context();
  const { data: recipient, error: lookupError } = await db
    .from("profiles")
    .select("id")
    .eq("slug", v.recipient_slug)
    .eq("is_public", true)
    .maybeSingle();
  if (lookupError) {
    // Do not mislabel connection, permissions, or schema errors as privacy.
    console.error("Credential recipient lookup failed", {
      code: lookupError.code,
    });
    go(
      path,
      "We could not check the recipient’s passport. Please try again. If it continues, contact ProofPak support.",
    );
  }
  if (!recipient)
    go(
      path,
      "No published passport matched that slug. Check the copied passport URL or slug. Private accounts cannot be searched here.",
    );
  const { error } = await db.rpc("issue_credential", {
    p_organization: v.organization_id,
    p_recipient: recipient.id,
    p_title: v.title,
    p_type: v.credential_type,
    p_description: v.description,
    p_issue_date: v.issue_date,
    p_expiry_date: v.expiry_date || null,
    p_program: v.program_name,
    p_award: v.award,
    p_evidence: v.evidence_url,
  });
  result(error, path);
  go(
    "/organizations?view=issued",
    "Credential issued privately. The recipient can accept or decline it in My Credentials.",
  );
}
export async function respondCredential(form: FormData) {
  const path = "/my-credentials";
  const v = parse(
    z.object({
      credential_id: z.uuid(),
      acceptance: z.enum(["accepted", "declined"]),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("respond_credential", {
    p_credential: v.credential_id,
    p_acceptance: v.acceptance,
    p_public: form.get("is_public") === "on",
    p_share_evidence: form.get("share_evidence") === "on",
  });
  result(error, path);
  go(path, "Your credential preferences were saved.");
}
export async function revokeCredential(form: FormData) {
  const path = "/organizations?view=issued";
  const v = parse(
    z.object({
      credential_id: z.uuid(),
      reason: z.string().trim().min(10).max(2000),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("revoke_credential", {
    p_credential: v.credential_id,
    p_reason: v.reason,
  });
  result(error, path);
  go(
    path,
    "Credential revoked. Historical facts remain unchanged. To correct it, issue a replacement and include the old credential ID in the description.",
  );
}
export async function authorizeIssuer(form: FormData) {
  const path = "/issuer-admin";
  const v = parse(
    z.object({
      organization_id: z.uuid(),
      note: z.string().trim().min(20).max(2000),
      decision: z.enum(["authorize", "suspend"]),
      reviewed_name: z.string(),
      reviewed_description: z.string(),
      reviewed_website: z.string(),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("authorize_issuer", {
    p_organization: v.organization_id,
    p_note: v.note,
    p_authorize: v.decision === "authorize",
    p_name: v.reviewed_name,
    p_description: v.reviewed_description,
    p_website: v.reviewed_website,
  });
  result(error, path);
  revalidatePath(path);
  go(
    path,
    "Issuer review recorded. This is a human authorization decision, not automatic identity verification.",
  );
}
export async function requestQualification(form: FormData) {
  const path = "/my-credentials";
  const v = parse(
    z.object({
      organization_id: z.uuid(),
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(20).max(4000),
      issue_date: z.iso.date(),
      evidence_url: z.url().refine((v) => /^https?:\/\//.test(v)),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("request_qualification_verification", {
    p_organization: v.organization_id,
    p_title: v.title,
    p_description: v.description,
    p_issue_date: v.issue_date,
    p_evidence: v.evidence_url,
  });
  result(error, path);
  go(
    path,
    "Request sent privately. Your qualification remains unverified until the institution reviews it.",
  );
}
export async function reviewQualification(form: FormData) {
  const path = "/organizations?view=requests";
  const v = parse(
    z.object({
      request_id: z.uuid(),
      feedback: z.string().trim().min(10).max(2000),
      decision: z.enum(["approve", "reject"]),
    }),
    form,
    path,
  );
  const db = await context();
  const { error } = await db.rpc("review_qualification_request", {
    p_request: v.request_id,
    p_approve: v.decision === "approve",
    p_feedback: v.feedback,
  });
  result(error, path);
  go(
    path,
    "Review saved. Approved requests create a private credential for recipient acceptance.",
  );
}
export async function disconnectWallet(form: FormData) {
  const path = "/wallet";
  const v = parse(z.object({ connection_id: z.uuid() }), form, path);
  const db = await context();
  const { error } = await db.rpc("disconnect_wallet", {
    p_connection: v.connection_id,
  });
  if (error)
    go(
      path,
      "Wallet link could not be disconnected. It may be locked by an accepted project or pending payment. Resolve that first, refresh, and try again. No wallet link was changed.",
    );
  result(error, path);
  revalidatePath(path);
  go(
    path,
    "Wallet link disconnected. Your email account, historical proofs, and transactions are unchanged. Any replacement requires a new ownership signature.",
  );
}
