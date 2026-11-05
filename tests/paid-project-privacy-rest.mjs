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

async function issuerRpc(name, args, role) {
  const response = await fetch(`${base}/rpc/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt(role)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}
async function issueArgs(type) {
  const org = (await read("organizations?select=id", 1)).data[0];
  return {
    p_organization: org.id,
    p_recipient: uid(2),
    p_title: "Scoped REST fixture",
    p_type: type,
    p_description: "A synthetic credential used to test direct API issuance.",
    p_issue_date: new Date().toISOString().slice(0, 10),
    p_expiry_date: null,
    p_program: "",
    p_award: "",
    p_evidence: "",
  };
}
test("issuer REST: permitted type succeeds and private representative attribution is server-derived", async () => {
  const r = await issuerRpc("issue_credential", await issueArgs("course"), 1);
  assert.equal(r.status, 200, JSON.stringify(r));
  const audit = await read(
    `credential_issuance_audit?credential_id=eq.${r.data}`,
    1,
  );
  assert.equal(audit.data[0].representative_id, uid(1));
  assert.equal(audit.data[0].authorized_credential_type, "course");
});
test("issuer REST: permitted organization reviewer is attributed to their own identity", async () => {
  const issued = await issuerRpc(
    "issue_credential",
    await issueArgs("course"),
    4,
  );
  assert.equal(issued.status, 200, JSON.stringify(issued));
  const row = (
    await read(`credential_issuance_audit?credential_id=eq.${issued.data}`, 4)
  ).data[0];
  assert.equal(row.representative_id, uid(4));
});
test("issuer REST: degree escalation, unrelated issuance and direct credential inserts are denied", async () => {
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("degree"), 1)).status,
    400,
  );
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("course"), 3)).status,
    400,
  );
  assert.ok([401, 403].includes((await read("credentials", 1, "POST")).status));
});
test("issuer REST: public provenance embeds correctly without exposing staff or private reviews", async () => {
  const r = await read(
    "credentials?select=id,credential_issuance_provenance(*)",
  );
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.data.length, 1);
  const row = r.data[0].credential_issuance_provenance;
  const p = Array.isArray(row) ? row[0] : row;
  assert.equal(p.representative_recorded, true);
  assert.equal(p.authorized_credential_type, "course");
  assert.deepEqual(
    Object.keys(p).sort(),
    [
      "credential_id",
      "authorization_id",
      "authorized_credential_type",
      "issued_at",
      "representative_recorded",
    ].sort(),
  );
  assert.equal((await read("credential_issuance_audit?select=*")).status, 401);
  assert.deepEqual(
    (await read("credential_issuance_audit?select=*", 2)).data,
    [],
  );
  assert.deepEqual(
    (await read("credential_issuance_audit?select=*", 3)).data,
    [],
  );
  assert.deepEqual((await read("issuer_authorizations?select=*", 1)).data, []);
  const history = await read(
    "issuer_authorizations?select=decision,allowed_credential_types",
    5,
  );
  assert.equal(history.data[0].decision, "approval");
});
test("issuer REST: withdrawing publication hides provenance as well as the credential", async () => {
  const id = (await read("credentials?select=id")).data[0].id;
  const args = {
    p_credential: id,
    p_acceptance: "accepted",
    p_public: false,
    p_share_evidence: false,
  };
  assert.equal((await issuerRpc("respond_credential", args, 2)).status, 204);
  assert.deepEqual(
    (await read("credential_issuance_provenance?select=*")).data,
    [],
  );
  assert.deepEqual((await read("credentials?select=id")).data, []);
  assert.equal(
    (await issuerRpc("respond_credential", { ...args, p_public: true }, 2))
      .status,
    204,
  );
  assert.equal(
    (await read("credential_issuance_provenance?select=*")).data.length,
    1,
  );
});
test("issuer REST: members cannot change permissions or forge attribution through raw writes", async () => {
  for (const table of [
    "organizations",
    "issuer_authorizations",
    "credential_issuance_audit",
    "credential_issuance_provenance",
  ])
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const r = await read(table, 1, method);
      assert.ok(
        [400, 401, 403, 405].includes(r.status),
        JSON.stringify({ table, method, ...r }),
      );
    }
  const org = (await read("organizations?select=id,authorization_id", 1))
    .data[0];
  const r = await issuerRpc(
    "review_issuer_authorization",
    {
      p_organization: org.id,
      p_note: "An ordinary member must not authorize their own issuer.",
      p_authorize: true,
      p_name: "Privacy Fixture",
      p_description: "Disposable local privacy test organization.",
      p_website: "https://example.com",
      p_types: ["degree"],
      p_expected_authorization: org.authorization_id,
    },
    1,
  );
  assert.equal(r.status, 400);
});

test("issuer REST: administrator scope changes and suspension are enforced; legacy approval cannot restore broad permissions", async () => {
  let org = (await read("organizations?select=id,authorization_id", 5)).data[0];
  const args = {
    p_organization: org.id,
    p_note: "Synthetic independent administrator lifecycle review.",
    p_name: "Privacy Fixture",
    p_description: "Disposable local privacy test organization.",
    p_website: "https://example.com",
  };
  assert.equal(
    (
      await issuerRpc(
        "review_issuer_authorization",
        {
          ...args,
          p_authorize: false,
          p_types: [],
          p_expected_authorization: org.authorization_id,
        },
        5,
      )
    ).status,
    204,
  );
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("course"), 1)).status,
    400,
  );
  const old = org.authorization_id;
  org = (await read("organizations?select=id,authorization_id", 5)).data[0];
  assert.equal(
    (
      await issuerRpc(
        "review_issuer_authorization",
        {
          ...args,
          p_authorize: true,
          p_types: ["degree"],
          p_expected_authorization: old,
        },
        5,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "review_issuer_authorization",
        {
          ...args,
          p_authorize: true,
          p_types: ["workshop"],
          p_expected_authorization: org.authorization_id,
        },
        5,
      )
    ).status,
    204,
  );
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("course"), 1)).status,
    400,
  );
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("workshop"), 1))
      .status,
    200,
  );
  const history = (
    await read("issuer_authorizations?select=decision", 5)
  ).data.map((r) => r.decision);
  assert.ok(history.includes("suspension"));
  assert.ok(history.includes("reinstatement"));
  assert.equal(
    (await issuerRpc("authorize_issuer", { ...args, p_authorize: true }, 5))
      .status,
    204,
  );
  assert.deepEqual(
    (await read("organizations?select=allowed_credential_types", 1)).data[0]
      .allowed_credential_types,
    [],
  );
  assert.equal(
    (await issuerRpc("issue_credential", await issueArgs("degree"), 1)).status,
    400,
  );
});

// Task 5: real local PostgREST assessment/issuance boundary, synthetic records only.
let workFixture;
async function workState() {
  if (workFixture) return workFixture;
  const org = (await read("organizations?select=id,authorization_id", 1))
    .data[0];
  assert.equal(
    (
      await issuerRpc(
        "review_issuer_authorization",
        {
          p_organization: org.id,
          p_note: "Synthetic explicit approval for assessed work recognition.",
          p_authorize: true,
          p_name: "Privacy Fixture",
          p_description: "Disposable local privacy test organization.",
          p_website: "https://example.com",
          p_types: ["company_achievement"],
          p_expected_authorization: org.authorization_id,
        },
        5,
      )
    ).status,
    204,
  );
  const c = (
    await read(
      "challenges?title=eq.REST%20assessed%20work%20fixture&select=id",
      1,
    )
  ).data[0];
  const s = (
    await read(`challenge_submissions?challenge_id=eq.${c.id}&select=id`, 1)
  ).data[0];
  const rubric = (
    await read(`challenge_public_rubrics?challenge_id=eq.${c.id}&select=*`)
  ).data[0];
  workFixture = {
    org: org.id,
    challenge: c.id,
    submission: s.id,
    rubric: rubric.id,
  };
  return workFixture;
}
async function workArgs() {
  const w = await workState();
  return {
    p_submission: w.submission,
    p_organization: w.org,
    p_title: "Assessed work recognition",
    p_type: "company_achievement",
    p_description:
      "Separate explicit recognition for reviewed accessible interface work.",
    p_issue_date: new Date().toISOString().slice(0, 10),
    p_expiry_date: null,
    p_award: "",
  };
}
test("assessment REST: public criteria exclude staff attribution; unrelated users cannot edit versions", async () => {
  const w = await workState();
  const pub = await read(`challenge_public_rubrics?id=eq.${w.rubric}&select=*`);
  assert.equal(pub.status, 200);
  assert.deepEqual(
    Object.keys(pub.data[0]).sort(),
    ["id", "challenge_id", "version", "criteria"].sort(),
  );
  assert.equal((await read("challenge_rubrics?select=*")).status, 401);
  assert.equal(
    (await read("challenge_public_rubrics?select=created_by")).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "set_challenge_rubric",
        { p_challenge: w.challenge, p_criteria: [] },
        3,
      )
    ).status,
    400,
  );
});
test("assessment REST: unreviewed work and legacy review bypass do not qualify", async () => {
  const w = await workState();
  assert.equal(
    (await issuerRpc("issue_challenge_credential", await workArgs(), 1)).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "review_submission",
        {
          p_submission_id: w.submission,
          p_decision: "approved",
          p_feedback: "A legacy RPC must not skip a rubric.",
        },
        1,
      )
    ).status,
    400,
  );
  const args = {
    p_submission_id: w.submission,
    p_decision: "approved",
    p_feedback: "Every defined criterion must be assessed.",
    p_outcomes: ["met"],
    p_expected_rubric: w.rubric,
  };
  assert.equal(
    (await issuerRpc("review_assessed_submission", args, 3)).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "review_assessed_submission",
        { ...args, p_outcomes: ["not_assessed"] },
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (await issuerRpc("review_assessed_submission", args, 1)).status,
    200,
  );
  assert.deepEqual(
    (await read("credential_challenge_context?select=*", 1)).data,
    [],
  );
  const assessment = await read(
    `challenge_assessments?submission_id=eq.${w.submission}&select=*`,
    2,
  );
  assert.deepEqual(assessment.data[0].outcomes, ["met"]);
});
test("assessment REST: explicit issuance links approved work and authenticated representative privately", async () => {
  const w = await workState();
  const r = await issuerRpc("issue_challenge_credential", await workArgs(), 1);
  assert.equal(r.status, 200, JSON.stringify(r));
  w.credential = r.data;
  const { credentialSelect } = await import("../src/lib/credentials.ts");
  const c = await read(
    `credentials?id=eq.${r.data}&select=${encodeURIComponent(credentialSelect)}`,
    1,
  );
  assert.equal(c.status, 200, JSON.stringify(c));
  const value = c.data[0].credential_challenge_context;
  const context = Array.isArray(value) ? value[0] : value;
  const { credentialEvidenceDigest } =
    await import("../src/lib/credential-proof.ts");
  assert.equal(
    await credentialEvidenceDigest(c.data[0].credential_evidence),
    c.data[0].evidence_digest,
  );
  assert.equal(context.assessment.submission_id, w.submission);
  assert.equal(context.assessment.organization_id, w.org);
  assert.equal(
    c.data[0].program_name,
    `Assessed work · sha256:${context.context_digest}`,
  );
  const { assessmentHash } = await import("../src/lib/challenge-assessment.ts");
  assert.equal(
    await assessmentHash(context.assessment),
    context.context_digest,
  );
  const audit = (
    await read(`credential_issuance_audit?credential_id=eq.${r.data}`, 1)
  ).data[0];
  assert.equal(audit.representative_id, uid(1));
  assert.equal(audit.authorization_id, c.data[0].authorization_id);
  assert.deepEqual(
    (await read(`credentials?id=eq.${r.data}&select=id`)).data,
    [],
  );
});
test("assessment REST: duplicate, unauthorized type, academic type and unrelated issuer attempts fail", async () => {
  const args = await workArgs();
  assert.equal(
    (await issuerRpc("issue_challenge_credential", args, 1)).status,
    409,
  );
  assert.equal(
    (
      await issuerRpc(
        "issue_challenge_credential",
        { ...args, p_type: "certification" },
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "issue_challenge_credential",
        { ...args, p_type: "degree" },
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (await issuerRpc("issue_challenge_credential", args, 3)).status,
    400,
  );
  for (const table of ["challenge_assessments", "challenge_credential_sources"])
    assert.deepEqual((await read(`${table}?select=*`, 3)).data, []);
});
test("assessment REST: publication and evidence consent independently protect assessment details", async () => {
  const w = await workState();
  const args = {
    p_credential: w.credential,
    p_acceptance: "accepted",
    p_public: true,
    p_share_evidence: false,
  };
  assert.equal((await issuerRpc("respond_credential", args, 2)).status, 204);
  let row = (
    await read(
      `credential_challenge_context?credential_id=eq.${w.credential}&select=*`,
    )
  ).data[0];
  assert.equal(row.assessment, null);
  assert.equal(row.challenge_title, "REST assessed work fixture");
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        { ...args, p_share_evidence: true },
        2,
      )
    ).status,
    204,
  );
  row = (
    await read(
      `credential_challenge_context?credential_id=eq.${w.credential}&select=*`,
    )
  ).data[0];
  assert.deepEqual(row.assessment.outcomes, ["met"]);
  for (const field of [
    "feedback",
    "explanation",
    "reviewer_id",
    "project_url",
    "github_url",
  ])
    assert.ok(!(field in row.assessment));
  assert.equal((await read("challenge_assessments?select=*")).status, 401);
  assert.equal(
    (await read("challenge_credential_sources?select=*")).status,
    401,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        { ...args, p_acceptance: "declined", p_public: false },
        2,
      )
    ).status,
    204,
  );
  assert.deepEqual(
    (
      await read(
        `credential_challenge_context?credential_id=eq.${w.credential}&select=*`,
      )
    ).data,
    [],
  );
});
