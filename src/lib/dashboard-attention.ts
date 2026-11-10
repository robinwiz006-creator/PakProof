import type { SupabaseClient } from "@supabase/supabase-js";

export type AttentionItem = {
  key: string;
  title: string;
  explanation: string;
  status: string;
  href: string;
  action: string;
  count: number;
  priority: number;
};
export type AttentionResult = {
  items: AttentionItem[];
  unavailable: string[];
  context?: string;
  emptyMessage?: string;
};
export type AttentionContext = {
  userId: string;
  role: "talent" | "company";
  memberships: { company_id: string; role: string; name?: string }[];
  companyId?: string;
  companyName?: string;
};
type Job = Omit<AttentionItem, "count"> & {
  source: string;
  read: () => Promise<number>;
};
const options = { count: "exact" as const, head: true };
const projectJoin =
  "paid_projects!paid_milestones_project_id_fkey!inner(company_id,worker_id,status)";
const applicationJoin =
  "paid_projects!paid_project_applications_project_id_fkey!inner(company_id,status)";

async function count(
  query: PromiseLike<{ count: number | null; error: unknown }>,
) {
  const result = await query;
  if (
    result.error ||
    result.count === null ||
    !Number.isSafeInteger(result.count) ||
    result.count < 0
  )
    throw new Error("Count unavailable");
  return result.count;
}
export async function collectAttention(
  jobs: Job[],
  context?: string,
): Promise<AttentionResult> {
  const results = await Promise.allSettled(
    jobs.map(async (j) => {
      const n = await j.read();
      if (!Number.isSafeInteger(n) || n < 0)
        throw new Error("Count unavailable");
      return { job: j, count: n };
    }),
  );
  const items: AttentionItem[] = [],
    unavailable: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") unavailable.push(jobs[i].source);
    else if (result.value.count > 0) {
      const item = result.value.job;
      // Deliberately return only summary fields; never query/error/provider objects.
      items.push({
        key: item.key,
        title: item.title,
        explanation: item.explanation,
        status: item.status,
        href: item.href,
        action: item.action,
        priority: item.priority,
        count: result.value.count,
      });
    }
  });
  items.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
  return { items, unavailable, context };
}

/** Request-scoped authenticated client only. The caller supplies memberships read for this user.
 * Explicit scopes complement RLS; no public/service-role client, records or evidence are used. */
export async function loadDashboardAttention(
  db: SupabaseClient,
  c: AttentionContext,
): Promise<AttentionResult> {
  if (!c.userId) return { items: [], unavailable: ["Account access"] };
  const timeout = () => AbortSignal.timeout(8000);
  const invitationJob: Job = {
    key: "credential-invitations",
    source: "Credential invitations",
    title: "Review credential invitations",
    explanation:
      "Review credentials sent to your verified email. Acceptance keeps them private.",
    status: "Your decision needed",
    href: "/credential-invitations",
    action: "Review invitations",
    priority: 19,
    read: () =>
      count(
        db
          .from("credential_invitation_inbox")
          .select("id", options)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .abortSignal(timeout()),
      ),
  };
  if (c.role === "talent")
    return collectAttention([
      invitationJob,
      {
        key: "milestone-work",
        source: "Milestone work",
        title: "Complete milestone work",
        explanation:
          "Submit your agreed work or address review feedback on active projects.",
        status: "Work needed",
        href: "/paid-projects?view=mine",
        action: "Open active work",
        priority: 10,
        read: () =>
          count(
            db
              .from("paid_milestones")
              .select(`id,${projectJoin}`, options)
              .in("work_status", ["not_submitted", "revisions"])
              .eq("paid_projects.worker_id", c.userId)
              .eq("paid_projects.status", "active")
              .abortSignal(timeout()),
          ),
      },
      {
        key: "challenge-revisions",
        source: "Challenge feedback",
        title: "Update challenge submissions",
        explanation:
          "Read the reviewer's feedback before submitting your changes.",
        status: "Changes requested",
        href: "/portal/talent/submissions",
        action: "Review feedback",
        priority: 11,
        read: () =>
          count(
            db
              .from("challenge_submissions")
              .select("id", options)
              .eq("talent_id", c.userId)
              .eq("status", "needs_improvement")
              .abortSignal(timeout()),
          ),
      },
      {
        key: "offers",
        source: "Project offers",
        title: "Review project offers",
        explanation:
          "Review the agreed scope and milestones before accepting or declining.",
        status: "Your decision needed",
        href: "/paid-projects?view=mine",
        action: "Review offers",
        priority: 20,
        read: () =>
          count(
            db
              .from("paid_projects")
              .select("id", options)
              .eq("worker_id", c.userId)
              .eq("status", "offered")
              .abortSignal(timeout()),
          ),
      },
      {
        key: "credentials",
        source: "Credential decisions",
        title: "Review received credentials",
        explanation:
          "Includes corrected replacements. Check each record's status before deciding; sharing remains your choice.",
        status: "Your decision needed",
        href: "/my-credentials",
        action: "Review credentials",
        priority: 30,
        read: () =>
          count(
            db
              .from("credential_preferences")
              .select("credential_id,credentials!inner(recipient_id)", options)
              .eq("credentials.recipient_id", c.userId)
              .eq("acceptance", "pending")
              .abortSignal(timeout()),
          ),
      },
      {
        key: "contact",
        source: "Contact requests",
        title: "Review invitations & contact requests",
        explanation:
          "Choose whether to continue with an organization. No contact details are shared automatically.",
        status: "Your decision needed",
        href: "/contact-requests",
        action: "Review requests",
        priority: 40,
        read: () =>
          count(
            db
              .from("visible_contact_requests")
              .select("id", options)
              .eq("candidate_id", c.userId)
              .eq("status", "pending")
              .abortSignal(timeout()),
          ),
      },
    ]);
  const member = c.memberships.find((m) => m.company_id === c.companyId);
  if (!member || !c.companyId) {
    if (c.companyId)
      return {
        items: [],
        unavailable: ["Organization access"],
        context: "Organization workspace",
      };
    const recipient = await collectAttention(
      [invitationJob],
      "Your credential invitations",
    );
    return {
      ...recipient,
      emptyMessage:
        "Choose or create an organization to check its pending actions.",
    };
  }
  const company = c.companyId;
  const jobs: Job[] = [
    invitationJob,
    {
      key: "accepted-invitations",
      source: "Accepted invitations",
      title: "Continue accepted invitations",
      explanation:
        "Candidates accepted contact. Review the opportunity and agree on next steps; acceptance did not create an application.",
      status: "Contact open",
      href: `/contact-requests?view=outgoing&company=${company}&status=accepted`,
      action: "Review accepted contact",
      priority: 40,
      read: () =>
        count(
          db
            .from("visible_contact_requests")
            .select("id", options)
            .eq("company_id", company)
            .eq("status", "accepted")
            .abortSignal(timeout()),
        ),
    },
    {
      key: "challenge-reviews",
      source: "Challenge reviews",
      title: "Review challenge submissions",
      explanation:
        "People are waiting for feedback on work submitted to this organization.",
      status: "Awaiting review",
      href: `/portal/company/reviews?company=${company}`,
      action: "Review submissions",
      priority: 10,
      read: () =>
        count(
          db
            .from("challenge_submissions")
            .select("id,challenges!inner(company_id)", options)
            .eq("challenges.company_id", company)
            .eq("status", "pending")
            .neq("talent_id", c.userId)
            .abortSignal(timeout()),
        ),
    },
    {
      key: "milestone-reviews",
      source: "Milestone reviews",
      title: "Review submitted milestones",
      explanation:
        "Approve delivery or request changes. Approval does not complete payment.",
      status: "Awaiting review",
      href: "/paid-projects?view=company",
      action: "Review milestones",
      priority: 11,
      read: () =>
        count(
          db
            .from("paid_milestones")
            .select(`id,${projectJoin}`, options)
            .eq("paid_projects.company_id", company)
            .eq("paid_projects.status", "active")
            .neq("paid_projects.worker_id", c.userId)
            .eq("work_status", "submitted")
            .abortSignal(timeout()),
        ),
    },
    {
      key: "applications",
      source: "Project applications",
      title: "Review project applications",
      explanation:
        "Review applications and choose a worker for published projects.",
      status: "Awaiting selection",
      href: "/paid-projects?view=company",
      action: "Review applications",
      priority: 30,
      read: () =>
        count(
          db
            .from("paid_project_applications")
            .select(`id,${applicationJoin}`, options)
            .eq("paid_projects.company_id", company)
            .eq("paid_projects.status", "published")
            .eq("status", "applied")
            .neq("worker_id", c.userId)
            .abortSignal(timeout()),
        ),
    },
    {
      key: "qualifications",
      source: "Organization permissions and qualification requests",
      title: "Review qualification requests",
      explanation:
        "Institution staff must review the private evidence before confirming a qualification.",
      status: "Awaiting institution review",
      href: "/organizations?view=requests",
      action: "Review requests",
      priority: 20,
      read: async () => {
        const { data: o, error } = await db
          .from("organizations")
          .select("id,issuer_status,organization_type,allowed_credential_types")
          .eq("company_id", company)
          .abortSignal(timeout())
          .maybeSingle();
        if (error) throw new Error("Organization access unavailable");
        if (
          !o ||
          o.issuer_status !== "authorized" ||
          o.organization_type !== "university" ||
          !o.allowed_credential_types?.includes("degree")
        )
          return 0;
        return count(
          db
            .from("qualification_requests")
            .select("id", options)
            .eq("organization_id", o.id)
            .neq("recipient_id", c.userId)
            .eq("status", "pending")
            .abortSignal(timeout()),
        );
      },
    },
  ];
  if (member.role === "owner")
    jobs.push({
      key: "payment-checks",
      source: "Payment preparations",
      title: "Check existing payment attempts",
      explanation:
        "Check the existing attempt before doing anything else. Never repay a pending or unknown transfer. Devnet test tokens have no monetary value.",
      status: "Check status first",
      href: "/payments",
      action: "Review payment status",
      priority: 0,
      read: () =>
        count(
          db
            .from("payment_intents")
            .select(
              `id,paid_milestones!payment_intents_milestone_id_fkey!inner(${projectJoin})`,
              options,
            )
            .eq("payer_user_id", c.userId)
            .eq("paid_milestones.paid_projects.company_id", company)
            .in("status", ["prepared", "registered", "pending", "needs_review"])
            .abortSignal(timeout()),
        ),
    });
  return collectAttention(jobs, c.companyName ?? "Selected organization");
}

/** Used only after the existing platform-administrator check. No self-review tasks. */
export async function loadAdministratorAttention(
  db: SupabaseClient,
  authorized: boolean,
  userId: string,
): Promise<AttentionResult> {
  if (!authorized || !userId) return { items: [], unavailable: [] };
  const timeout = () => AbortSignal.timeout(8000);
  const {
    data: members,
    error,
    count: membershipCount,
  } = await db
    .from("company_memberships")
    .select("company_id", { count: "exact" })
    .limit(1000)
    .eq("user_id", userId)
    .abortSignal(timeout());
  if (
    error ||
    membershipCount === null ||
    membershipCount !== (members ?? []).length
  )
    return { items: [], unavailable: ["Independent review permissions"] };
  const excluded = (members ?? []).map((m) => m.company_id);
  const read = (table: string, pending = false) => {
    let q = db.from(table).select("id", options);
    if (pending) q = q.eq("issuer_status", "pending");
    if (excluded.length)
      q = q.not("company_id", "in", `(${excluded.join(",")})`);
    return count(q.abortSignal(timeout()));
  };
  return collectAttention(
    [
      {
        key: "institution-review",
        source: "Institutional verification",
        title: "Review organization verification",
        explanation:
          "Review institutional evidence independently. Organizations you belong to are excluded.",
        status: "Awaiting administrator review",
        href: "/issuer-admin?trust=pending",
        action: "Review verification",
        priority: 10,
        read: () => read("administrator_verification_queue"),
      },
      {
        key: "category-review",
        source: "Issuer category review",
        title: "Review issuer category access",
        explanation:
          "Institutional trust and permission to issue credential categories are separate decisions.",
        status: "Awaiting administrator review",
        href: "/issuer-admin?status=pending",
        action: "Review issuers",
        priority: 20,
        read: () => read("organizations", true),
      },
    ],
    "Platform administration",
  );
}
