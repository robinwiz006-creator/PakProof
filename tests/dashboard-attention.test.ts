import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import {
  collectAttention,
  loadDashboardAttention,
  loadAdministratorAttention,
  type AttentionContext,
} from "../src/lib/dashboard-attention";
const company = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002",
  user = "fixture-user";
const talent: AttentionContext = {
  userId: user,
  role: "talent",
  memberships: [],
};
const context: AttentionContext = {
  userId: user,
  role: "company",
  memberships: [
    { company_id: company, role: "owner" },
    { company_id: other, role: "reviewer" },
  ],
  companyId: company,
  companyName: "Fixture university",
};
type FixtureOptions = {
  counts?: Record<string, number>;
  fail?: string[];
  throws?: string[];
  organization?: unknown;
  members?: { company_id: string }[];
  nullCount?: string[];
  membershipCount?: number;
};
function fixture(o: FixtureOptions = {}) {
  const calls: { table: string; params: URLSearchParams; method: string }[] =
    [];
  const db = createClient(
    "https://fixture.invalid",
    "offline-public-fixture-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          const u = new URL(String(input)),
            table = u.pathname.split("/").at(-1)!;
          calls.push({
            table,
            params: u.searchParams,
            method: init?.method ?? "GET",
          });
          if (o.throws?.includes(table))
            throw new Error("PRIVATE-TRANSPORT-DETAIL");
          if (o.fail?.includes(table))
            return new Response(
              JSON.stringify({ message: "PRIVATE-SQL-DETAIL" }),
              { status: 403, headers: { "Content-Type": "application/json" } },
            );
          if (init?.method === "HEAD")
            return new Response(null, {
              status: 200,
              headers: {
                "content-range": o.nullCount?.includes(table)
                  ? "*/*"
                  : `*/${o.counts?.[table] ?? 0}`,
              },
            });
          const data =
            table === "company_memberships"
              ? (o.members ?? [])
              : o.organization === undefined
                ? {
                    id: "org",
                    issuer_status: "authorized",
                    organization_type: "university",
                    allowed_credential_types: ["degree"],
                  }
                : o.organization;
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...(table === "company_memberships"
                ? {
                    "content-range": `*/${o.membershipCount ?? (o.members ?? []).length}`,
                  }
                : {}),
            },
          });
        },
      },
    },
  );
  return { db, calls };
}
test("personal sources use current-user/status filters and never query company/admin tasks", async () => {
  const { db, calls } = fixture({
    counts: {
      credential_preferences: 3,
      challenge_submissions: 1,
      paid_projects: 2,
      visible_contact_requests: 1,
      paid_milestones: 1,
    },
  });
  const result = await loadDashboardAttention(db, talent);
  assert.equal(
    calls.find((c) => c.table === "paid_milestones")?.params.get("work_status"),
    "in.(not_submitted,revisions)",
  );
  assert.deepEqual(
    result.items.map((x) => x.key),
    [
      "milestone-work",
      "challenge-revisions",
      "offers",
      "credentials",
      "contact",
    ],
  );
  assert.equal(result.items.find((x) => x.key === "credentials")?.count, 3);
  for (const c of calls) {
    assert.equal(c.method, "HEAD");
    assert.ok(!c.params.get("select")?.includes("*"));
    assert.ok(
      ![
        "organizations",
        "payment_intents",
        "administrator_verification_queue",
      ].includes(c.table),
    );
  }
  assert.equal(
    calls
      .find((c) => c.table === "credential_preferences")
      ?.params.get("credentials.recipient_id"),
    "eq." + user,
  );
  assert.equal(
    calls
      .find((c) => c.table === "paid_milestones")
      ?.params.get("paid_projects.worker_id"),
    "eq." + user,
  );
  assert.equal(
    calls
      .find((c) => c.table === "paid_milestones")
      ?.params.get("paid_projects.status"),
    "eq.active",
  );
  assert.equal(
    calls
      .find((c) => c.table === "visible_contact_requests")
      ?.params.get("candidate_id"),
    "eq." + user,
  );
  assert.ok(!JSON.stringify(result).includes("offline-public-fixture-key"));
});
test("organization counts are scoped to selected company and self-review is excluded", async () => {
  const { db, calls } = fixture({
    counts: {
      paid_milestones: 2,
      challenge_submissions: 4,
      qualification_requests: 1,
      paid_project_applications: 3,
      payment_intents: 1,
    },
  });
  const result = await loadDashboardAttention(db, context);
  // Application deadlines block new applications, not review of existing applicants.
  assert.equal(
    calls
      .find((c) => c.table === "paid_project_applications")
      ?.params.get("paid_projects.deadline"),
    null,
  );
  assert.equal(result.context, "Fixture university");
  assert.equal(result.items[0].key, "payment-checks");
  assert.equal(result.items.length, 5);
  assert.equal(
    calls
      .find((c) => c.table === "challenge_submissions")
      ?.params.get("challenges.company_id"),
    "eq." + company,
  );
  assert.equal(
    calls
      .find((c) => c.table === "challenge_submissions")
      ?.params.get("talent_id"),
    "neq." + user,
  );
  assert.equal(
    calls
      .find((c) => c.table === "paid_milestones")
      ?.params.get("paid_projects.company_id"),
    "eq." + company,
  );
  assert.equal(
    calls
      .find((c) => c.table === "paid_project_applications")
      ?.params.get("paid_projects.company_id"),
    "eq." + company,
  );
  assert.equal(
    calls
      .find((c) => c.table === "payment_intents")
      ?.params.get("payer_user_id"),
    "eq." + user,
  );
  assert.equal(
    calls
      .find((c) => c.table === "payment_intents")
      ?.params.get("paid_milestones.paid_projects.company_id"),
    "eq." + company,
  );
  assert.ok(
    result.items.some(
      (i) => i.href === `/portal/company/reviews?company=${company}`,
    ),
  );
  assert.ok(
    result.items.every(
      (i) =>
        !i.href.includes("/issuer-admin") &&
        !i.href.includes("/my-credentials"),
    ),
  );
});
test("switching organizations selects the correct membership and removes owner-only payment tasks", async () => {
  const { db, calls } = fixture({
    counts: { payment_intents: 99, paid_project_applications: 2 },
    organization: null,
  });
  const result = await loadDashboardAttention(db, {
    ...context,
    companyId: other,
    companyName: "Other organization",
  });
  assert.ok(!calls.some((c) => c.table === "payment_intents"));
  assert.ok(!calls.some((c) => c.table === "qualification_requests"));
  assert.ok(
    !result.items.some(
      (i) => i.key === "qualifications" || i.key === "payment-checks",
    ),
  );
  assert.equal(
    calls
      .find((c) => c.table === "paid_project_applications")
      ?.params.get("paid_projects.company_id"),
    "eq." + other,
  );
  assert.equal(result.context, "Other organization");
});
test("unrelated organizations and anonymous users cannot query organization sources", async () => {
  const { db, calls } = fixture();
  const denied = await loadDashboardAttention(db, {
    ...context,
    companyId: "unrelated",
  });
  assert.equal(denied.items.length, 0);
  assert.deepEqual(denied.unavailable, ["Organization access"]);
  await loadDashboardAttention(db, { ...talent, userId: "" });
  await loadAdministratorAttention(db, false, user);
  assert.equal(calls.length, 0);
});
test("unauthorized, suspended or category-restricted issuers cannot get qualification-review actions", async () => {
  for (const org of [
    null,
    {
      id: "org",
      issuer_status: "suspended",
      organization_type: "university",
      allowed_credential_types: ["degree"],
    },
    {
      id: "org",
      issuer_status: "authorized",
      organization_type: "university",
      allowed_credential_types: ["course"],
    },
    {
      id: "org",
      issuer_status: "authorized",
      organization_type: "training",
      allowed_credential_types: ["degree"],
    },
  ]) {
    const { db, calls } = fixture({
      organization: org,
      counts: { qualification_requests: 9 },
    });
    const result = await loadDashboardAttention(db, context);
    assert.ok(!calls.some((c) => c.table === "qualification_requests"));
    assert.ok(!result.items.some((i) => i.key === "qualifications"));
  }
});
test("empty and partial errors remain distinct; failure does not erase valid results or expose errors", async () => {
  const empty = await loadDashboardAttention(fixture().db, talent);
  assert.equal(empty.items.length, 0);
  assert.equal(empty.unavailable.length, 0);
  const { db } = fixture({
    fail: ["paid_projects"],
    counts: { credential_preferences: 2 },
  });
  const result = await loadDashboardAttention(db, talent);
  assert.equal(result.items[0].key, "credentials");
  assert.deepEqual(result.unavailable, ["Project offers"]);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  const bad = await loadDashboardAttention(
    fixture({ nullCount: ["paid_projects"] }).db,
    talent,
  );
  assert.ok(bad.unavailable.includes("Project offers"));
  const transport = await loadDashboardAttention(
    fixture({
      throws: ["paid_projects"],
      counts: { credential_preferences: 1 },
    }).db,
    talent,
  );
  assert.equal(transport.items[0].key, "credentials");
  assert.ok(transport.unavailable.includes("Project offers"));
});
test("every source can fail independently without producing a false no-pending result", async () => {
  const { db } = fixture({
    fail: [
      "paid_milestones",
      "challenge_submissions",
      "paid_projects",
      "credential_preferences",
      "visible_contact_requests",
    ],
  });
  const result = await loadDashboardAttention(db, talent);
  assert.equal(result.items.length, 0);
  assert.equal(result.unavailable.length, 5);
});
test("administrator summaries exclude own companies and retain independent source failures", async () => {
  const { db, calls } = fixture({
    members: [{ company_id: company }],
    counts: { organizations: 3 },
    fail: ["administrator_verification_queue"],
  });
  const result = await loadAdministratorAttention(db, true, user);
  assert.equal(result.items[0].key, "category-review");
  assert.deepEqual(result.unavailable, ["Institutional verification"]);
  for (const c of calls.filter((c) => c.method === "HEAD"))
    assert.equal(c.params.get("company_id"), `not.in.(${company})`);
  assert.equal(calls[0].params.get("user_id"), "eq." + user);
  assert.equal(result.items[0].href, "/issuer-admin?status=pending");
  const truncated = fixture({
    members: [{ company_id: company }],
    membershipCount: 1001,
  });
  const incomplete = await loadAdministratorAttention(truncated.db, true, user);
  assert.deepEqual(incomplete.unavailable, ["Independent review permissions"]);
  assert.ok(!truncated.calls.some((c) => c.method === "HEAD"));
  const denied = await loadAdministratorAttention(
    fixture({ fail: ["company_memberships"] }).db,
    true,
    user,
  );
  assert.deepEqual(denied.unavailable, ["Independent review permissions"]);
  assert.equal(denied.items.length, 0);
});
test("read-only summaries contain actionable links, no payment execution links or evidence payloads", async () => {
  const personal = await loadDashboardAttention(
    fixture({ counts: { paid_projects: 1, credential_preferences: 1 } }).db,
    talent,
  );
  const org = await loadDashboardAttention(
    fixture({ counts: { payment_intents: 1 } }).db,
    context,
  );
  for (const item of [...personal.items, ...org.items]) {
    assert.ok(item.title && item.explanation && item.status && item.action);
    assert.ok(item.href.startsWith("/"));
    assert.ok(!item.href.startsWith("/api/"));
    assert.ok(!("evidence" in item));
  }
  assert.equal(org.items[0].action, "Review payment status");
  assert.match(org.items[0].explanation, /Never repay/);
});
test("independent jobs start concurrently, order by priority, and reject invalid counts", async () => {
  let running = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const base = {
    source: "fixture",
    title: "Review",
    explanation: "Review",
    status: "Pending",
    href: "/my-credentials",
    action: "Review",
  };
  const loading = collectAttention([
    {
      ...base,
      key: "later",
      priority: 2,
      read: async () => {
        running++;
        await gate;
        return 2;
      },
    },
    {
      ...base,
      key: "first",
      priority: 1,
      read: async () => {
        running++;
        await gate;
        return 1;
      },
    },
    { ...base, key: "broken", priority: 3, read: async () => NaN },
  ]);
  assert.equal(running, 2);
  release();
  const result = await loading;
  assert.deepEqual(
    result.items.map((i) => i.key),
    ["first", "later"],
  );
  assert.deepEqual(result.unavailable, ["fixture"]);
});

test("invitation attention uses a recipient-only database projection", async () => {
  const { db, calls } = fixture({ counts: { credential_invitation_inbox: 2 } });
  const result = await loadDashboardAttention(db, talent);
  const item = result.items.find((i) => i.key === "credential-invitations");
  assert.equal(item?.href, "/credential-invitations");
  assert.equal(item?.count, 2);
  const query = calls.find((q) => q.table === "credential_invitation_inbox");
  assert.equal(query?.params.get("status"), "eq.pending");
  assert.ok(query?.params.get("expires_at")?.startsWith("gt."));
  assert.ok(!calls.some((q) => q.table === "credential_invitations"));
});

test("company users without an organization still see only their own invitation attention", async () => {
  const { db, calls } = fixture({ counts: { credential_invitation_inbox: 1 } });
  const result = await loadDashboardAttention(db, {
    ...context,
    companyId: undefined,
    memberships: [],
  });
  assert.equal(result.items[0]?.key, "credential-invitations");
  assert.deepEqual(
    calls.map((c) => c.table),
    ["credential_invitation_inbox"],
  );
});
