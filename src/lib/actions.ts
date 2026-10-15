"use server";
import { messageLink } from "./navigation-message";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safeReturnPath } from "./passport";
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
  redirect(messageLink(path, message));
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
  const next = safeReturnPath(String(form.get("next") ?? ""));
  redirect(
    next ??
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
  const { error } = await db.from("projects").insert({
    ...values,
    skills: skillsList(values.skills),
    talent_id: user.id,
  });
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

export type ProjectFormState = {
  error: string;
  values?: Record<string, string>;
};
export async function saveProject(
  _previous: ProjectFormState,
  form: FormData,
): Promise<ProjectFormState> {
  const { db, user } = await context();
  const values = Object.fromEntries(
    [...form.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const parsed = projectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const id = form.get("project_id");
  const data = { ...parsed.data, skills: skillsList(parsed.data.skills) };
  const result = id
    ? await db
        .from("projects")
        .update(data)
        .eq("id", id)
        .eq("talent_id", user.id)
        .select("id")
        .maybeSingle()
    : await db
        .from("projects")
        .insert({ ...data, talent_id: user.id })
        .select("id")
        .single();
  if (result.error || !result.data)
    return {
      error:
        "Could not save this project. Check the links and that you own it, then try again.",
      values,
    };
  revalidatePath("/", "layout");
  go("/portal/talent/projects", id ? "Project updated." : "Project added.");
}
export async function previewPassport() {
  const { db, user } = await context();
  const { error } = await db
    .from("profiles")
    .update({ passport_previewed_at: new Date().toISOString() })
    .eq("id", user.id);
  databaseError("/portal/talent/passport", error);
  revalidatePath("/", "layout");
  redirect("/portal/talent/preview");
}
export async function saveAchievementSharing(form: FormData) {
  const { db, user } = await context();
  const id = validate(
    z.string().uuid(),
    form.get("achievement_id"),
    "/portal/talent/achievements",
  );
  const project = String(form.get("project_id") ?? "");
  if (project)
    validate(z.string().uuid(), project, "/portal/talent/achievements");
  const { data: a } = await db
    .from("achievements")
    .select("id")
    .eq("id", id)
    .eq("talent_id", user.id)
    .maybeSingle();
  if (!a)
    go(
      "/portal/talent/achievements",
      "You can only share your own achievements.",
    );
  const { error } = await db.from("achievement_sharing").upsert({
    achievement_id: id,
    share_evidence: form.get("share_evidence") === "on",
    project_id: project || null,
  });
  databaseError("/portal/talent/achievements", error);
  revalidatePath("/", "layout");
  go(
    "/portal/talent/achievements",
    "Sharing choices saved. Approved facts are unchanged.",
  );
}
export async function sendReset(form: FormData) {
  if (!isConfigured())
    go("/forgot-password", "Account recovery requires Supabase.");
  const email = validate(
    z.string().email(),
    form.get("email"),
    "/forgot-password",
  );
  const db = await supabase();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?purpose=recovery`,
  });
  if (error)
    go(
      "/forgot-password",
      "Could not send a reset email right now. Wait and try again.",
    );
  go(
    "/forgot-password",
    "If that email has an account, a password reset link will be sent. Check your inbox and spam folder.",
  );
}
export async function resendConfirmation(form: FormData) {
  if (!isConfigured())
    go("/resend-confirmation", "Email confirmation requires Supabase.");
  const email = validate(
    z.string().email(),
    form.get("email"),
    "/resend-confirmation",
  );
  const db = await supabase();
  const { error } = await db.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error)
    go(
      "/resend-confirmation",
      "Could not send a confirmation email right now. Wait and try again.",
    );
  go(
    "/resend-confirmation",
    "If confirmation is needed, a new link will be sent. Check your inbox and spam folder.",
  );
}
export async function resetPassword(form: FormData) {
  const { db } = await context();
  const password = validate(
    z.string().min(10),
    form.get("password"),
    "/reset-password",
  );
  if (password !== form.get("confirm_password"))
    go("/reset-password", "The passwords must match.");
  const { error } = await db.auth.updateUser({ password });
  if (error)
    go(
      "/reset-password",
      "Could not update your password. Request a new reset link and try again.",
    );
  go("/portal/talent/settings", "Password updated.");
}

export async function saveProfileStep(
  _previous: { error: string; values?: Record<string, string> },
  form: FormData,
): Promise<{ error: string; values?: Record<string, string> }> {
  const { db, user } = await context();
  const step = String(form.get("step"));
  const values = Object.fromEntries(
    [...form.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  let patch;
  try {
    const { profileStepPatch } = await import("./profile-setup");
    patch = profileStepPatch(step, values);
  } catch (e) {
    return {
      error:
        e instanceof z.ZodError
          ? e.issues[0].message
          : "Please check your profile details.",
      values,
    };
  }
  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id")
    .single();
  if (error || !data)
    return {
      error:
        error?.code === "23505"
          ? "That profile link is already in use. Choose another."
          : "We could not save your changes. Your other profile details have not changed. Try again.",
      values,
    };
  revalidatePath("/", "layout");
  const next =
    step === "about" ? "skills" : step === "skills" ? "work" : "publish";
  go(
    next === "work"
      ? "/portal/talent/projects"
      : `/portal/talent/profile?step=${next}`,
    step === "publish"
      ? "is_public" in patch && patch.is_public
        ? "Your Skill Passport is published. You can copy its link and share it."
        : "Your profile is private. Only you can preview it."
      : "Saved. Continue below or return later.",
  );
}
