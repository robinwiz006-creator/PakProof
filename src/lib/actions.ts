"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase, isConfigured } from "./supabase/server";
import {
  profileSchema,
  companySchema,
  projectSchema,
  challengeSchema,
  submissionSchema,
  reviewSchema,
  skillsList,
} from "./validation";
function go(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}
function raw(form: FormData) {
  return Object.fromEntries(form.entries());
}
async function context() {
  if (!isConfigured())
    go(
      "/sign-in",
      "Connect Supabase in environment settings to use real accounts.",
    );
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  return { db, user };
}
function validate<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
  const result = schema.safeParse(data);
  if (!result.success) go(path, result.error.issues[0].message);
  return result.data;
}
function databaseError(
  path: string,
  error: { message: string; code?: string } | null,
) {
  if (error)
    go(
      path,
      error.code === "23505"
        ? "That public URL or record already exists. Choose another."
        : error.code === "42501"
          ? "You do not have permission to change this record."
          : "Could not save this change. Check your access and database setup, then try again.",
    );
}
export async function signUp(form: FormData) {
  if (!isConfigured())
    go("/sign-up", "Connect Supabase before creating an account.");
  const values = validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(10),
      full_name: z.string().trim().min(2).max(100),
      role: z.enum(["talent", "company"]),
    }),
    raw(form),
    "/sign-up",
  );
  const db = await supabase();
  // Refuse signup before profiles exist, rather than creating an unusable account.
  const { error: schemaError } = await db
    .from("profiles")
    .select("id")
    .limit(0);
  if (schemaError)
    go(
      "/sign-up",
      "Account setup is not ready yet. Please contact the platform administrator.",
    );
  const { data, error } = await db.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: { full_name: values.full_name, preferred_role: values.role },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error)
    go(
      "/sign-up",
      "Account could not be created. Check your email, password, and authentication settings.",
    );
  if (data.session) redirect(`/portal/${values.role}`);
  go("/sign-in", "Check your email to confirm your account, then sign in.");
}
export async function signIn(form: FormData) {
  if (!isConfigured()) go("/sign-in", "Connect Supabase before signing in.");
  const values = validate(
    z.object({ email: z.string().email(), password: z.string().min(1) }),
    raw(form),
    "/sign-in",
  );
  const db = await supabase();
  const { data, error } = await db.auth.signInWithPassword(values);
  if (error)
    go(
      "/sign-in",
      "Sign in failed. Check your email and password, and confirm your email if required.",
    );
  redirect(
    `/portal/${data.user?.user_metadata.preferred_role === "company" ? "company" : "talent"}`,
  );
}
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/");
}
export async function saveProfile(form: FormData) {
  const { db, user } = await context();
  const path = "/portal/talent/profile";
  const values = validate(
    profileSchema,
    { ...raw(form), is_public: form.get("is_public") === "on" },
    path,
  );
  const { error } = await db
    .from("profiles")
    .update({ ...values, skills: skillsList(values.skills) })
    .eq("id", user.id);
  databaseError(path, error);
  revalidatePath("/", "layout");
  go(path, "Profile saved.");
}
export async function saveCompany(form: FormData) {
  const { db } = await context();
  const path = "/portal/company/profile";
  const values = validate(companySchema, raw(form), path);
  const id = form.get("company_id");
  const { error } = id
    ? await db.from("companies").update(values).eq("id", id)
    : await db.rpc("create_company", {
        p_name: values.name,
        p_description: values.description,
        p_website: values.website,
        p_location: values.location,
      });
  databaseError(path, error);
  revalidatePath("/", "layout");
  go(path, "Company profile saved.");
}
export async function addProject(form: FormData) {
  const { db, user } = await context();
  const path = "/portal/talent/projects";
  const values = validate(projectSchema, raw(form), path);
  const { error } = await db
    .from("projects")
    .insert({ ...values, talent_id: user.id });
  databaseError(path, error);
  revalidatePath("/", "layout");
  go(path, "Project added.");
}
export async function deleteProject(form: FormData) {
  const { db, user } = await context();
  const id = validate(
    z.string().uuid(),
    form.get("project_id"),
    "/portal/talent/projects",
  );
  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("talent_id", user.id);
  databaseError("/portal/talent/projects", error);
  revalidatePath("/", "layout");
}
export async function createChallenge(form: FormData) {
  const { db } = await context();
  const path = "/portal/company/create";
  const values = validate(challengeSchema, raw(form), path);
  const company_id = validate(z.string().uuid(), form.get("company_id"), path);
  const { error } = await db.from("challenges").insert({
    ...values,
    skills: skillsList(values.skills),
    company_id,
    status: "published",
  });
  databaseError(path, error);
  revalidatePath("/", "layout");
  go("/portal/company/challenges", "Challenge published.");
}
export async function closeChallenge(form: FormData) {
  const { db } = await context();
  const path = "/portal/company/challenges";
  const id = validate(z.string().uuid(), form.get("challenge_id"), path);
  const { error } = await db
    .from("challenges")
    .update({ status: "closed" })
    .eq("id", id);
  databaseError(path, error);
  revalidatePath("/", "layout");
}
export async function submitWork(form: FormData) {
  const { db } = await context();
  const path = "/portal/talent/submissions";
  const values = validate(submissionSchema, raw(form), path);
  const { error } = await db.rpc("submit_work", {
    p_challenge_id: values.challenge_id,
    p_project_url: values.project_url,
    p_github_url: values.github_url,
    p_explanation: values.explanation,
  });
  databaseError(path, error);
  revalidatePath("/", "layout");
  go(path, "Work submitted for review.");
}
export async function reviewSubmission(form: FormData) {
  const { db } = await context();
  const path = "/portal/company/reviews";
  const values = validate(reviewSchema, raw(form), path);
  const { error } = await db.rpc("review_submission", {
    p_submission_id: values.submission_id,
    p_decision: values.decision,
    p_feedback: values.feedback,
  });
  databaseError(path, error);
  revalidatePath("/", "layout");
  go(
    path,
    values.decision === "approved"
      ? "Submission approved. The achievement is issued; its Solana proof is pending."
      : "Feedback sent. The candidate can revise and resubmit.",
  );
}
