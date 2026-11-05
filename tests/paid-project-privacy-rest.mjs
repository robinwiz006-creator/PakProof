import test, { before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const base = process.env.PRIVACY_API_URL;
const uid = (n) => `a0000000-0000-4000-8000-00000000000${n}`;
function jwt(n) {
  const head = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({
      role: "authenticated",
      sub: uid(n),
      exp: Math.floor(Date.now() / 1000) + 600,
    }),
  ).toString("base64url");
  const msg = `${head}.${body}`;
  return `${msg}.${createHmac("sha256", "proofpak-local-test-secret-at-least-32-characters").update(msg).digest("base64url")}`;
}
async function read(path, n, method = "GET") {
  const r = await fetch(`${base}/${path}`, {
    method,
    headers: {
      ...(n ? { Authorization: `Bearer ${jwt(n)}` } : {}),
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
    },
    ...(!["GET", "DELETE"].includes(method)
      ? { body: JSON.stringify({ title: "Unauthorized modification" }) }
      : {}),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
before(async () => {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await read("public_paid_projects?select=id")).status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw Error("Local PostgREST did not become ready");
});
for (const role of [undefined, 3]) {
  const label = role ? "unrelated authenticated" : "anonymous";
  test(`${label}: fixed public project columns and company embedding across statuses`, async () => {
    const r = await read(
      "public_paid_projects?select=*,companies(name)&order=status",
      role,
    );
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.length, 4);
    assert.deepEqual(r.data.map((p) => p.status).sort(), [
      "active",
      "completed",
      "offered",
      "published",
    ]);
    for (const p of r.data) {
      assert.equal(p.companies.name, "Privacy Fixture");
      assert.deepEqual(
        Object.keys(p).sort(),
        [
          "id",
          "company_id",
          "title",
          "description",
          "requirements",
          "skills",
          "deadline",
          "budget_units",
          "status",
          "created_at",
          "companies",
        ].sort(),
      );
    }
  });
  test(`${label}: restricted project columns cannot be selected or filtered through REST`, async () => {
    for (const field of [
      "worker_id",
      "current_offer_id",
      "payout_authorization_id",
    ]) {
      assert.equal(
        (await read(`public_paid_projects?select=${field}`, role)).status,
        400,
      );
      assert.equal(
        (await read(`public_paid_projects?${field}=not.is.null`, role)).status,
        400,
      );
    }
    const raw = await read(
      "paid_projects?select=worker_id,current_offer_id,payout_authorization_id",
      role,
    );
    if (role) {
      assert.equal(raw.status, 200);
      assert.deepEqual(raw.data, []);
    } else assert.equal(raw.status, 401);
  });
  test(`${label}: milestone public projection excludes operational fields and drafts`, async () => {
    const r = await read("public_paid_milestones?select=*", role);
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 4);
    for (const m of r.data)
      assert.deepEqual(
        Object.keys(m).sort(),
        [
          "id",
          "project_id",
          "position",
          "title",
          "deliverables",
          "deadline",
          "amount_units",
        ].sort(),
      );
    for (const field of ["current_submission_id", "approval_id", "work_status"])
      assert.equal(
        (await read(`public_paid_milestones?select=${field}`, role)).status,
        400,
      );
    const raw = await read("paid_milestones?select=*", role);
    if (role) assert.deepEqual(raw.data, []);
    else assert.equal(raw.status, 401);
  });
  test(`${label}: private applications, offers, evidence, payment authorizations and receipts remain inaccessible`, async () => {
    for (const table of [
      "paid_project_applications",
      "paid_project_offers",
      "paid_milestone_submissions",
      "paid_milestone_reviews",
      "paid_payout_authorizations",
      "payment_intents",
      "payment_attempts",
      "payment_receipts",
    ]) {
      const r = await read(`${table}?select=*`, role);
      if (role) {
        assert.equal(r.status, 200, table);
        assert.deepEqual(r.data, [], table);
      } else assert.equal(r.status, 401, table);
    }
  });
  test(`${label}: public views cannot be written through REST`, async () => {
    for (const table of ["public_paid_projects", "public_paid_milestones"])
      for (const method of ["POST", "PATCH", "DELETE"]) {
        const r = await read(table, role, method);
        assert.ok(
          [401, 403, 405].includes(r.status),
          JSON.stringify({ table, method, ...r }),
        );
      }
  });
}
for (const role of [1, 2, 4])
  test(`${role === 1 ? "company owner" : role === 2 ? "selected worker" : "company reviewer"}: operational project, milestones, applications and evidence access retained`, async () => {
    const projects = await read("paid_projects?select=*", role);
    assert.equal(projects.status, 200);
    assert.equal(projects.data.length, 5);
    for (const p of projects.data) {
      assert.equal(p.worker_id, uid(2));
      assert.ok("current_offer_id" in p);
      assert.ok("payout_authorization_id" in p);
    }
    for (const table of [
      "paid_milestones",
      "paid_project_applications",
      "paid_milestone_submissions",
    ]) {
      const r = await read(`${table}?select=*`, role);
      assert.equal(r.status, 200, table);
      assert.equal(r.data.length, 5, table);
    }
  });

test("real REST workflow preserves the boundary through draft, publication, selection, acceptance and offer decline", async () => {
  async function rpc(name, args, role) {
    const r = await fetch(`${base}/rpc/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt(role)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    const data = await r.json().catch(() => null);
    assert.ok(r.ok, JSON.stringify({ name, data }));
    return data;
  }
  const company = (await read("paid_projects?select=company_id&limit=1", 1))
    .data[0].company_id;
  const deadline = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  let id = await rpc(
    "create_paid_project",
    {
      p_company: company,
      p_title: "Transition fixture",
      p_description:
        "Synthetic workflow project with sufficient detailed description.",
      p_requirements: "Synthetic safe requirements and a clear handover.",
      p_skills: ["SQL"],
      p_deadline: deadline,
      p_budget: "1000000",
      p_milestones: [
        {
          title: "Delivery fixture",
          deliverables: "Synthetic deliverables with adequate detail.",
          deadline,
          amount_units: "1000000",
        },
      ],
    },
    1,
  );
  async function boundary(status, workerVisible) {
    const pub = await read(`public_paid_projects?id=eq.${id}&select=*`);
    assert.equal(pub.data.length, status === "draft" ? 0 : 1);
    if (pub.data.length) {
      assert.equal(pub.data[0].status, status);
      assert.ok(!("worker_id" in pub.data[0]));
      assert.ok(!("current_offer_id" in pub.data[0]));
      assert.ok(!("payout_authorization_id" in pub.data[0]));
    }
    assert.deepEqual(
      (await read(`paid_projects?id=eq.${id}&select=*`, 3)).data,
      [],
    );
    assert.equal(
      (await read(`paid_projects?id=eq.${id}&select=*`, 2)).data.length,
      workerVisible ? 1 : 0,
    );
  }
  await boundary("draft", false);
  await rpc("publish_paid_project", { p_project: id }, 1);
  await boundary("published", false);
  await rpc(
    "apply_paid_project",
    {
      p_project: id,
      p_pitch:
        "Synthetic application provides sufficient relevant work experience.",
      p_evidence: "https://example.com/work",
    },
    2,
  );
  const application = (
    await read(`paid_project_applications?project_id=eq.${id}&select=id`, 2)
  ).data[0].id;
  const firstOffer = await rpc(
    "select_paid_worker",
    { p_application: application },
    1,
  );
  await boundary("offered", true);
  await rpc("respond_paid_offer", { p_offer: firstOffer, p_accept: false }, 2);
  await boundary("published", false);
  // A declined worker keeps their own application/offer but loses private project access.
  assert.equal(
    (await read(`paid_project_offers?id=eq.${firstOffer}&select=response`, 2))
      .data[0].response,
    "declined",
  );
  // Exercise a real acceptance on a separate project, preserving declined terms.
  id = await rpc(
    "create_paid_project",
    {
      p_company: company,
      p_title: "Acceptance fixture",
      p_description:
        "Synthetic workflow project with sufficient detailed description.",
      p_requirements: "Synthetic safe requirements and a clear handover.",
      p_skills: ["SQL"],
      p_deadline: deadline,
      p_budget: "1000000",
      p_milestones: [
        {
          title: "Delivery fixture",
          deliverables: "Synthetic deliverables with adequate detail.",
          deadline,
          amount_units: "1000000",
        },
      ],
    },
    1,
  );
  await rpc("publish_paid_project", { p_project: id }, 1);
  await rpc(
    "apply_paid_project",
    {
      p_project: id,
      p_pitch:
        "Synthetic relevant experience and a sufficiently detailed application.",
      p_evidence: "https://example.com/evidence",
    },
    2,
  );
  const app = (
    await read(`paid_project_applications?project_id=eq.${id}&select=id`, 2)
  ).data[0].id;
  const acceptedOffer = await rpc(
    "select_paid_worker",
    { p_application: app },
    1,
  );
  await rpc(
    "respond_paid_offer",
    { p_offer: acceptedOffer, p_accept: true },
    2,
  );
  await boundary("active", true);
});
