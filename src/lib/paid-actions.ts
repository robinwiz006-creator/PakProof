"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { credentialWorkspace } from "./credential-data";
import { tokenUnits } from "./payments";
function go(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}
function parse<T>(schema: z.ZodType<T>, form: FormData, path: string) {
  const result = schema.safeParse(Object.fromEntries(form));
  if (!result.success) go(path, result.error.issues[0].message);
  return result.data;
}
const url = z
  .url()
  .refine((v) => /^https?:\/\//.test(v), "Use an HTTP or HTTPS evidence URL.");
async function mutate(
  name: string,
  args: Record<string, unknown>,
  path: string,
  message: string,
) {
  const { db } = await credentialWorkspace();
  const { error } = await db.rpc(name, args);
  if (error)
    go(
      path,
      error.code === "23505"
        ? "This application or decision already exists."
        : "Could not save. Check your permissions and the current project status, then try again.",
    );
  revalidatePath("/paid-projects", "layout");
  go(path, message);
}
export async function createPaidProject(form: FormData) {
  const path = "/paid-projects/new";
  const v = parse(
    z.object({
      company_id: z.uuid(),
      title: z.string().trim().min(3).max(160),
      description: z.string().trim().min(30).max(5000),
      requirements: z.string().trim().min(20).max(4000),
      skills: z.string().max(500),
      deadline: z.iso.date(),
      budget: z.string(),
      milestones: z.string().max(100000),
    }),
    form,
    path,
  );
  let milestones;
  let budget;
  try {
    budget = tokenUnits(v.budget);
    const items = z
      .array(
        z.object({
          title: z.string().trim().min(3).max(160),
          deliverables: z.string().trim().min(20).max(4000),
          deadline: z.iso.date(),
          amount: z.string(),
        }),
      )
      .min(1)
      .max(20)
      .parse(JSON.parse(v.milestones));
    milestones = items.map((m) => ({
      title: m.title,
      deliverables: m.deliverables,
      deadline: m.deadline,
      amount_units: tokenUnits(m.amount),
    }));
    if (
      milestones.reduce((sum, m) => sum + BigInt(m.amount_units), 0n) !==
      BigInt(budget)
    )
      throw new Error("Milestone amounts must equal the total budget.");
    if (milestones.some((m) => m.deadline > v.deadline))
      throw new Error(
        "Milestone deadlines must be on or before the project deadline.",
      );
  } catch (e) {
    go(path, e instanceof Error ? e.message : "Check milestone details.");
  }
  const { db } = await credentialWorkspace();
  const { data, error } = await db.rpc("create_paid_project", {
    p_company: v.company_id,
    p_title: v.title,
    p_description: v.description,
    p_requirements: v.requirements,
    p_skills: v.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    p_deadline: v.deadline,
    p_budget: budget,
    p_milestones: milestones,
  });
  if (error)
    go(
      path,
      "Could not create the draft. Check your company membership, amounts, deadlines and migration setup.",
    );
  redirect(`/paid-projects/${data}`);
}
export async function publishPaidProject(form: FormData) {
  const v = parse(z.object({ project_id: z.uuid() }), form, "/paid-projects");
  await mutate(
    "publish_paid_project",
    { p_project: v.project_id },
    `/paid-projects/${v.project_id}`,
    "Project published. Individuals can now apply.",
  );
}
export async function applyPaidProject(form: FormData) {
  const v = parse(
    z.object({
      project_id: z.uuid(),
      pitch: z.string().trim().min(20).max(4000),
      evidence_url: url,
    }),
    form,
    "/paid-projects",
  );
  await mutate(
    "apply_paid_project",
    { p_project: v.project_id, p_pitch: v.pitch, p_evidence: v.evidence_url },
    `/paid-projects/${v.project_id}`,
    "Application sent. Track the company's decision here.",
  );
}
export async function selectPaidWorker(form: FormData) {
  const v = parse(
    z.object({ application_id: z.uuid(), project_id: z.uuid() }),
    form,
    "/paid-projects",
  );
  await mutate(
    "select_paid_worker",
    { p_application: v.application_id },
    `/paid-projects/${v.project_id}`,
    "Terms offered to this worker. Work can start once they accept.",
  );
}
export async function respondPaidOffer(form: FormData) {
  const v = parse(
    z.object({
      offer_id: z.uuid(),
      project_id: z.uuid(),
      decision: z.enum(["accept", "decline"]),
    }),
    form,
    "/paid-projects",
  );
  await mutate(
    "respond_paid_offer",
    { p_offer: v.offer_id, p_accept: v.decision === "accept" },
    `/paid-projects/${v.project_id}`,
    v.decision === "accept"
      ? "Terms accepted. You can submit milestone work. Payment is separate from approval."
      : "Offer declined. No payment obligation was accepted.",
  );
}
export async function submitPaidMilestone(form: FormData) {
  const v = parse(
    z.object({
      project_id: z.uuid(),
      milestone_id: z.uuid(),
      explanation: z.string().trim().min(20).max(5000),
      evidence_url: url,
    }),
    form,
    "/paid-projects",
  );
  await mutate(
    "submit_paid_milestone",
    {
      p_milestone: v.milestone_id,
      p_explanation: v.explanation,
      p_evidence: v.evidence_url,
    },
    `/paid-projects/${v.project_id}`,
    "Work submitted for company review.",
  );
}
export async function reviewPaidMilestone(form: FormData) {
  const v = parse(
    z.object({
      project_id: z.uuid(),
      milestone_id: z.uuid(),
      decision: z.enum(["approved", "revisions"]),
      feedback: z.string().trim().min(10).max(2000),
    }),
    form,
    "/paid-projects",
  );
  await mutate(
    "review_paid_milestone",
    {
      p_milestone: v.milestone_id,
      p_decision: v.decision,
      p_feedback: v.feedback,
    },
    `/paid-projects/${v.project_id}`,
    v.decision === "approved"
      ? "Work approved. Payment is still due; only verified settlement marks it paid."
      : "Revision requested. The worker can submit an updated version.",
  );
}
