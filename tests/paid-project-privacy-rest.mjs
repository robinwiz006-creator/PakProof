import test, { before } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
const base = process.env.PRIVACY_API_URL;
const uid = (n) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
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
      ...(role ? { Authorization: `Bearer ${jwt(role)}` } : {}),
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

let employerCompany, employerRequest;
async function employerSearch(overrides = {}, role = 1) {
  if (!employerCompany)
    employerCompany = (await read("paid_projects?select=company_id&limit=1", 1))
      .data[0].company_id;
  return issuerRpc(
    "search_passports",
    {
      p_company: employerCompany,
      p_query: "",
      p_skill: "",
      p_credentials: false,
      p_assessed: false,
      p_saved: false,
      p_page: 1,
      ...overrides,
    },
    role,
  );
}
test("discovery REST: server pages contain only opt-ins with stable alphabetical order", async () => {
  const first = await employerSearch();
  const second = await employerSearch({ p_page: 2 });
  assert.equal(first.status, 200, JSON.stringify(first));
  assert.equal(first.data.total, 24);
  assert.equal(first.data.items.length, 20);
  assert.equal(second.data.items.length, 4);
  assert.ok(
    first.data.items.every(
      (x) => !second.data.items.some((y) => y.id === x.id),
    ),
  );
  const match = await employerSearch({ p_query: "energy", p_skill: "react" });
  assert.equal(match.data.total, 1);
  assert.equal(match.data.items[0].id, uid(10));
  assert.equal(
    match.data.items[0].projects[0].title,
    "Public Discovery Project",
  );
  for (const q of [
    "Hidden Directory",
    "Private Directory",
    "Undiscoverable",
    "private-assessment-evidence",
    "%",
  ])
    assert.equal((await employerSearch({ p_query: q })).data.total, 0, q);
  assert.equal((await employerSearch({}, 3)).status, 400);
  assert.equal((await employerSearch({}, null)).status, 401);
});
test("discovery REST: credentials and unshared assessments cannot reveal hidden existence", async () => {
  assert.equal((await employerSearch({ p_credentials: true })).data.total, 0);
  assert.equal((await employerSearch({ p_assessed: true })).data.total, 0);
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: true, p_contact: true },
        2,
      )
    ).status,
    204,
  );
  assert.equal((await employerSearch({ p_credentials: true })).data.total, 1);
  assert.equal((await employerSearch({ p_assessed: true })).data.total, 0);
  const achievement = (await read("achievements?select=id", 2)).data[0];
  const r = await fetch(`${base}/achievement_sharing`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt(2)}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      achievement_id: achievement.id,
      share_assessment: true,
    }),
  });
  assert.ok(r.ok);
  const visible = await employerSearch({ p_assessed: true });
  assert.equal(visible.data.total, 1);
  assert.equal(visible.data.items[0].achievements[0].assessed, true);
  assert.ok(!JSON.stringify(visible.data).includes("Private submission"));
});
test("shortlist REST: company isolation, note updates and direct write denial", async () => {
  assert.equal(
    (
      await issuerRpc(
        "save_candidate",
        {
          p_company: employerCompany,
          p_candidate: uid(10),
          p_note: "Private team note",
        },
        1,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await issuerRpc(
        "save_candidate",
        {
          p_company: employerCompany,
          p_candidate: uid(10),
          p_note: "Updated team note",
        },
        1,
      )
    ).status,
    204,
  );
  const saved = await employerSearch({ p_saved: true });
  assert.equal(saved.data.total, 1);
  assert.equal(saved.data.items[0].internal_note, "Updated team note");
  assert.deepEqual((await read("employer_shortlists?select=*", 3)).data, []);
  assert.deepEqual((await read("employer_shortlists?select=*", 10)).data, []);
  assert.equal((await read("employer_shortlists?select=*")).status, 401);
  for (const method of ["POST", "PATCH", "DELETE"])
    assert.ok(
      [400, 401, 403].includes(
        (await read("employer_shortlists", 1, method)).status,
      ),
    );
  assert.equal(
    (
      await issuerRpc(
        "remove_saved_candidate",
        { p_company: employerCompany, p_candidate: uid(10) },
        3,
      )
    ).status,
    400,
  );
});
test("contact REST: concurrent duplicate attempts create only one request without exposing staff details", async () => {
  const args = {
    p_company: employerCompany,
    p_candidate: uid(10),
    p_purpose: "We would like to discuss your public accessibility work.",
  };
  const responses = await Promise.all([
    issuerRpc("create_contact_request", args, 1),
    issuerRpc("create_contact_request", args, 1),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  employerRequest = responses.find((r) => r.status === 200).data;
  const inbox = await read(
    `visible_contact_requests?id=eq.${employerRequest}&select=*,companies(name)`,
    10,
  );
  assert.equal(inbox.status, 200, JSON.stringify(inbox));
  assert.equal(inbox.data.length, 1);
  assert.ok(!("created_by" in inbox.data[0]));
  assert.equal(
    (await read("visible_contact_requests?select=created_by", 10)).status,
    400,
  );
  assert.deepEqual((await read("contact_requests?select=*", 10)).data, []);
  assert.deepEqual(
    (await read("visible_contact_requests?select=*", 3)).data,
    [],
  );
  assert.equal((await read("visible_contact_requests?select=*")).status, 401);
  assert.ok(
    [400, 401, 403].includes(
      (await read("contact_requests", 1, "PATCH")).status,
    ),
  );
});
test("contact REST: only recipient accepts/withdraws; no contact information is shared", async () => {
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: employerRequest, p_decision: "accepted" },
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: employerRequest, p_decision: "accepted" },
        10,
      )
    ).status,
    204,
  );
  let row = (await read(`visible_contact_requests?id=eq.${employerRequest}`, 1))
    .data[0];
  assert.equal(row.status, "accepted");
  assert.ok(!("email" in row));
  assert.ok(!("phone" in row));
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: employerRequest, p_decision: "declined" },
        10,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: employerRequest, p_decision: "accepted" },
        10,
      )
    ).status,
    400,
  );
});
test("discovery REST: privacy withdrawal hides search, saved notes and company contact access immediately", async () => {
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: false, p_contact: false },
        10,
      )
    ).status,
    204,
  );
  assert.equal((await employerSearch({ p_saved: true })).data.total, 0);
  assert.deepEqual((await read("employer_shortlists?select=*", 1)).data, []);
  assert.deepEqual(
    (await read(`visible_contact_requests?id=eq.${employerRequest}`, 1)).data,
    [],
  );
  assert.equal(
    (await read(`visible_contact_requests?id=eq.${employerRequest}`, 10)).data
      .length,
    1,
  );
  assert.equal(
    (
      await issuerRpc(
        "create_contact_request",
        {
          p_company: employerCompany,
          p_candidate: uid(10),
          p_purpose: "Another attempt cannot bypass candidate opt-out.",
        },
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: true, p_contact: true },
        10,
      )
    ).status,
    204,
  );
  assert.equal((await employerSearch({ p_saved: true })).data.total, 1);
  assert.equal(
    (
      await issuerRpc(
        "remove_saved_candidate",
        { p_company: employerCompany, p_candidate: uid(10) },
        1,
      )
    ).status,
    204,
  );
  assert.equal((await employerSearch({ p_saved: true })).data.total, 0);
});
test("contact REST: invalid opportunity links and daily spam limits are enforced server-side", async () => {
  const privateProject = (
    await read("paid_projects?status=eq.draft&select=id", 1)
  ).data[0];
  assert.equal(
    (
      await issuerRpc(
        "create_contact_request",
        {
          p_company: employerCompany,
          p_candidate: uid(11),
          p_purpose: "A private draft must not be advertised in a request.",
          p_paid_project: privateProject.id,
        },
        1,
      )
    ).status,
    400,
  );
  for (let n = 11; n <= 19; n++)
    assert.equal(
      (
        await issuerRpc(
          "create_contact_request",
          {
            p_company: employerCompany,
            p_candidate: uid(n),
            p_purpose:
              "Synthetic bounded outreach for real local quota testing.",
          },
          1,
        )
      ).status,
      200,
    );
  const limit = await issuerRpc(
    "create_contact_request",
    {
      p_company: employerCompany,
      p_candidate: uid(20),
      p_purpose: "The eleventh request must be blocked by quota.",
    },
    1,
  );
  assert.equal(limit.status, 400);
  assert.match(limit.data.message, /Daily contact limit/);
  const other = await issuerRpc(
    "create_company",
    {
      p_name: "Other employer fixture",
      p_description: "Synthetic company to test the per-actor daily quota.",
      p_website: "https://example.com",
      p_location: "Karachi",
    },
    1,
  );
  assert.equal(other.status, 200);
  assert.equal(
    (
      await issuerRpc(
        "create_contact_request",
        {
          p_company: other.data,
          p_candidate: uid(20),
          p_purpose: "New company ownership cannot bypass per-person quotas.",
        },
        1,
      )
    ).status,
    400,
  );
});

test("contact REST: contact opt-out preserves directory listing but blocks acceptance and company access", async () => {
  const row = (
    await read(
      `visible_contact_requests?candidate_id=eq.${uid(11)}&select=id`,
      1,
    )
  ).data[0];
  assert.ok(row);
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: true, p_contact: false },
        11,
      )
    ).status,
    204,
  );
  const search = await employerSearch({ p_query: "Directory REST Fixture 11" });
  assert.equal(search.data.total, 1);
  assert.equal(search.data.items[0].allow_contact_requests, false);
  assert.deepEqual(
    (await read(`visible_contact_requests?id=eq.${row.id}`, 1)).data,
    [],
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: row.id, p_decision: "accepted" },
        11,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_contact_request",
        { p_request: row.id, p_decision: "declined" },
        11,
      )
    ).status,
    204,
  );
});

test("lifecycle endpoints deny anonymous and unrelated project cancellation; private history stays private", async () => {
  const project = (await read("public_paid_projects?select=id&limit=1"))
    .data[0];
  assert.ok(project);
  for (const role of [undefined, 3]) {
    const r = await issuerRpc(
      "change_paid_lifecycle",
      {
        p_project: project.id,
        p_action: "cancel",
        p_reason: "Unrelated cancellation through the direct API.",
      },
      role,
    );
    assert.ok(r.status >= 400);
  }
  for (const table of ["paid_project_events", "paid_cancellation_requests"]) {
    const anon = await read(`${table}?select=*`);
    assert.ok(anon.status >= 400);
    const other = await read(`${table}?select=*`, 3);
    assert.equal(other.status, 200);
    assert.deepEqual(other.data, []);
    const insert = await read(table, 3, "POST");
    assert.ok(insert.status >= 400);
  }
});
test("lifecycle REST: draft edits preserve milestone IDs and publication locks terms; withdrawal removes only the public projection", async () => {
  const membership = (
    await read(
      `company_memberships?select=company_id&user_id=eq.${uid(1)}&role=eq.owner&limit=1`,
      1,
    )
  ).data[0];
  assert.ok(membership);
  const fields = {
    p_title: "Lifecycle fixture project",
    p_description:
      "An isolated lifecycle fixture with accessible dashboard deliverables.",
    p_requirements:
      "Deliver accessible source and an independently reviewable preview.",
    p_skills: ["React"],
    p_deadline: "2030-12-01",
    p_budget: "1250000",
    p_milestones: [
      {
        title: "Dashboard milestone",
        deliverables:
          "An accessible deployed dashboard and documented source code.",
        deadline: "2030-11-01",
        amount_units: "1250000",
      },
    ],
  };
  const created = await issuerRpc(
    "create_paid_project",
    { p_company: membership.company_id, ...fields },
    1,
  );
  assert.equal(created.status, 200);
  const id = created.data;
  const original = (await read(`paid_projects?id=eq.${id}&select=*`, 1))
    .data[0];
  const ms = (
    await read(`paid_milestones?project_id=eq.${id}&select=*&order=position`, 1)
  ).data;
  const expected = {
    title: original.title,
    description: original.description,
    requirements: original.requirements,
    skills: original.skills,
    deadline: original.deadline,
    budget_units: String(original.budget_units),
    milestones: ms,
  };
  const edit = {
    p_project: id,
    ...fields,
    p_title: "Corrected lifecycle fixture",
    p_expected: expected,
  };
  assert.equal((await issuerRpc("edit_paid_project", edit, 3)).status, 400);
  assert.equal((await issuerRpc("edit_paid_project", edit, 1)).status, 204);
  assert.equal(
    (await read(`paid_milestones?project_id=eq.${id}&select=id`, 1)).data[0].id,
    ms[0].id,
  );
  assert.ok((await issuerRpc("edit_paid_project", edit, 1)).status >= 400);
  assert.equal(
    (await issuerRpc("publish_paid_project", { p_project: id }, 1)).status,
    204,
  );
  assert.ok((await issuerRpc("edit_paid_project", edit, 1)).status >= 400);
  assert.equal(
    (
      await issuerRpc(
        "change_paid_lifecycle",
        {
          p_project: id,
          p_action: "withdraw",
          p_reason:
            "Withdraw this isolated opportunity without erasing its history.",
        },
        1,
      )
    ).status,
    204,
  );
  assert.deepEqual(
    (await read(`public_paid_projects?id=eq.${id}&select=*`)).data,
    [],
  );
  assert.equal(
    (await read(`paid_projects?id=eq.${id}&select=status`, 1)).data[0].status,
    "withdrawn",
  );
  assert.equal(
    (await read(`paid_project_events?project_id=eq.${id}&select=id`, 1)).data
      .length,
    2,
  );
  assert.deepEqual(
    (await read(`paid_project_events?project_id=eq.${id}&select=*`, 3)).data,
    [],
  );
});

// Revocation privacy: real PostgREST roles, no hosted data or wallet activity.
let revoked;
let revokedRaw;
let revokedClaimHash;
const revocationReason =
  "Public fixture explanation: event results were corrected.";
async function revocationCredential(role) {
  const { credentialSelect } = await import("../src/lib/credentials.ts");
  return read(
    `credentials?id=eq.${revoked}&select=${encodeURIComponent(credentialSelect)}`,
    role,
  );
}
test("revocation REST: anonymous status projection retains public explanation/date and application embedding", async () => {
  const orgs = (
    await read(
      "organizations?select=*,companies(name,description,website)&issuer_status=eq.authorized",
      1,
    )
  ).data;
  const members = (await read("company_memberships?select=company_id", 1)).data;
  const org = orgs.find(
    (o) =>
      members.some((m) => m.company_id === o.company_id) &&
      o.allowed_credential_types.length,
  );
  assert.ok(org);
  const issued = await issuerRpc(
    "issue_credential",
    {
      ...(await issueArgs(org.allowed_credential_types[0])),
      p_organization: org.id,
      p_title: "Revocation privacy fixture",
    },
    1,
  );
  assert.equal(issued.status, 200, JSON.stringify(issued));
  revoked = issued.data;
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: revoked,
          p_acceptance: "accepted",
          p_public: true,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  const { credentialClaim, credentialHash } =
    await import("../src/lib/credential-proof.ts");
  revokedClaimHash = await credentialHash(
    credentialClaim((await revocationCredential(1)).data[0]),
  );
  assert.equal(
    (
      await issuerRpc(
        "revoke_credential",
        { p_credential: revoked, p_reason: revocationReason },
        1,
      )
    ).status,
    204,
  );
  const publicEvent = await read(
    `public_credential_events?credential_id=eq.${revoked}&select=*`,
  );
  assert.equal(publicEvent.status, 200, JSON.stringify(publicEvent));
  assert.equal(publicEvent.data.length, 1);
  assert.deepEqual(
    Object.keys(publicEvent.data[0]).sort(),
    ["credential_id", "event_type", "reason", "created_at"].sort(),
  );
  assert.equal(publicEvent.data[0].event_type, "revoked");
  assert.equal(publicEvent.data[0].reason, revocationReason);
  assert.ok(publicEvent.data[0].created_at);
  const embedded = await revocationCredential();
  assert.equal(embedded.status, 200, JSON.stringify(embedded));
  assert.equal(embedded.data[0].credential_events[0].event_type, "revoked");
  const { credentialValidity } = await import("../src/lib/credentials.ts");
  assert.equal(credentialValidity(embedded.data[0]), "Revoked");
});
test("revocation REST: anonymous raw column reads, filters and metadata queries are denied", async () => {
  for (const path of [
    "credential_events?select=*",
    "credential_events?select=actor_id",
    `credential_events?actor_id=eq.${uid(1)}&select=credential_id`,
    `credential_events?select=id&order=actor_id`,
  ]) {
    assert.ok((await read(path)).status >= 400, path);
  }
  for (const query of [
    "select=actor_id",
    "select=id",
    "select=administrator_id",
    "select=review_note",
    `actor_id=eq.${uid(1)}&select=credential_id`,
    `order=actor_id`,
  ]) {
    assert.ok(
      (await read(`public_credential_events?${query}`)).status >= 400,
      query,
    );
  }
  const rawEmbed = await read(
    `credentials?id=eq.${revoked}&select=id,credential_events(actor_id)`,
  );
  assert.ok(rawEmbed.status >= 400, JSON.stringify(rawEmbed));
  assert.ok(
    (await read("issuer_authorizations?select=administrator_id,review_note"))
      .status >= 400,
  );
});
test("revocation REST: unrelated authenticated callers cannot retrieve attribution directly or by embedding", async () => {
  for (const path of [
    "credential_events?select=*",
    `credential_events?actor_id=eq.${uid(1)}&select=*`,
  ]) {
    const r = await read(path, 3);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, []);
  }
  const embedded = await read(
    `credentials?id=eq.${revoked}&select=id,credential_events(*)`,
    3,
  );
  assert.equal(embedded.status, 200);
  assert.deepEqual(embedded.data[0].credential_events, []);
  assert.deepEqual(
    (await read("issuer_authorizations?select=review_note,administrator_id", 3))
      .data,
    [],
  );
  const safe = await revocationCredential(3);
  assert.equal(safe.status, 200);
  assert.equal(safe.data[0].credential_events.length, 1);
});
test("revocation REST: issuer staff and administrator retain complete attributable immutable audit", async () => {
  for (const role of [1, 4, 5]) {
    const r = await read(
      `credential_events?credential_id=eq.${revoked}&select=*`,
      role,
    );
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].actor_id, uid(1));
    assert.ok(r.data[0].id);
    if (role === 1) revokedRaw = r.data[0];
  }
  const history = await read(
    "issuer_authorizations?select=administrator_id,review_note",
    5,
  );
  assert.equal(history.status, 200);
  assert.ok(history.data.some((h) => h.review_note));
});
test("revocation REST: recipient retains status without staff IDs; publication and acceptance remain independent", async () => {
  assert.deepEqual(
    (await read(`credential_events?credential_id=eq.${revoked}`, 2)).data,
    [],
  );
  for (const [acceptance, publish] of [
    ["accepted", false],
    ["declined", true],
  ]) {
    assert.equal(
      (
        await issuerRpc(
          "respond_credential",
          {
            p_credential: revoked,
            p_acceptance: acceptance,
            p_public: publish,
            p_share_evidence: false,
          },
          2,
        )
      ).status,
      204,
    );
    assert.deepEqual(
      (await read(`public_credential_events?credential_id=eq.${revoked}`)).data,
      [],
    );
    assert.deepEqual(
      (await read(`public_credential_events?credential_id=eq.${revoked}`, 3))
        .data,
      [],
    );
    const owner = await read(
      `public_credential_events?credential_id=eq.${revoked}`,
      2,
    );
    assert.equal(owner.data.length, 1);
    assert.equal(
      (await read(`credential_events?credential_id=eq.${revoked}`, 5)).data
        .length,
      1,
    );
  }
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: revoked,
          p_acceptance: "accepted",
          p_public: true,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
});
test("revocation REST: public and private records cannot be written or unrevoked through either API surface", async () => {
  for (const role of [undefined, 1, 2, 3, 5])
    for (const table of ["credential_events", "public_credential_events"])
      for (const method of ["PATCH", "DELETE", "POST"]) {
        const r = await fetch(`${base}/${table}?credential_id=eq.${revoked}`, {
          method,
          headers: {
            ...(role ? { Authorization: `Bearer ${jwt(role)}` } : {}),
            "Content-Type": "application/json",
          },
          ...(method !== "DELETE"
            ? {
                body: JSON.stringify(
                  method === "POST"
                    ? {
                        credential_id: revoked,
                        actor_id: uid(3),
                        event_type: "revoked",
                        reason: "Forged lifecycle event must be denied.",
                      }
                    : {
                        reason:
                          "Attempt to overwrite historical public explanation.",
                      },
                ),
              }
            : {}),
        });
        assert.ok(r.status >= 400, `${role}:${table}:${method}:${r.status}`);
      }
  assert.deepEqual(
    (await read(`credential_events?credential_id=eq.${revoked}&select=*`, 1))
      .data[0],
    revokedRaw,
  );
});
test("revocation REST: revocation projection does not alter the historical v3 claim commitment", async () => {
  const { credentialClaim, credentialHash } =
    await import("../src/lib/credential-proof.ts");
  const { credentialValidity } = await import("../src/lib/credentials.ts");
  const c = (await revocationCredential()).data[0];
  assert.equal(credentialValidity(c), "Revoked");
  assert.equal(await credentialHash(credentialClaim(c)), revokedClaimHash);
  assert.equal(c.credential_events[0].reason, revocationReason);
});

let correctionOriginal, correctionFirst, correctionAccepted, originalClaimHash;
async function correctionArgs(id) {
  const c = (
    await read(`credentials?id=eq.${id}&select=*,credential_evidence(*)`, 1)
  ).data[0];
  return {
    p_original: id,
    p_reason: "PRIVATE correction investigation note",
    p_title: "Corrected assessed recognition",
    p_description: "A corrected description of the same approved work.",
    p_issue_date: new Date().toISOString().slice(0, 10),
    p_expiry_date: null,
    p_program: c.program_name,
    p_award: "",
    p_evidence: c.credential_evidence.evidence_url,
  };
}
async function correctionCredential(id, role) {
  const { credentialSelect } = await import("../src/lib/credentials.ts");
  return read(
    `credentials?id=eq.${id}&select=${encodeURIComponent(credentialSelect)}`,
    role,
  );
}
test("correction REST: one initial work credential remains protected; concurrent proposals create only one replacement", async () => {
  const source = (
    await read(
      "challenge_credential_sources?select=credential_id&correction_root_id=is.null",
      1,
    )
  ).data[0];
  correctionOriginal = source.credential_id;
  const c = (await correctionCredential(correctionOriginal, 1)).data[0];
  const { credentialHash, credentialClaim } =
    await import("../src/lib/credential-proof.ts");
  originalClaimHash = await credentialHash(credentialClaim(c));
  const args = await correctionArgs(correctionOriginal);
  const attempts = await Promise.all([
    issuerRpc("correct_credential", args, 1),
    issuerRpc("correct_credential", args, 1),
  ]);
  assert.deepEqual(
    attempts.map((a) => a.status).sort(),
    [200, 400],
    JSON.stringify(attempts),
  );
  correctionFirst = attempts.find((a) => a.status === 200).data;
  const dup = await issuerRpc(
    "issue_challenge_credential",
    await workArgs(),
    1,
  );
  assert.equal(dup.status, 409, JSON.stringify(dup));
  const next = (await correctionCredential(correctionFirst, 2)).data[0];
  assert.equal(next.credential_preferences.acceptance, "pending");
  assert.equal(next.credential_preferences.is_public, false);
  assert.equal(
    next.credential_correction_status.replaces_id,
    correctionOriginal,
  );
  assert.match(next.description, /Correction reference sha256:[a-f0-9]{64}\./);
});
test("correction REST: assessment commitment, recipient, issuer, category and representative are preserved", async () => {
  const a = (
    await read(
      `challenge_credential_sources?credential_id=eq.${correctionOriginal}&select=*`,
      1,
    )
  ).data[0];
  const b = (
    await read(
      `challenge_credential_sources?credential_id=eq.${correctionFirst}&select=*`,
      1,
    )
  ).data[0];
  for (const key of [
    "manifest",
    "context_digest",
    "submission_id",
    "review_id",
    "organization_id",
    "credential_type",
  ])
    assert.deepEqual(b[key], a[key]);
  assert.equal(b.correction_root_id, correctionOriginal);
  const audit = (
    await read(
      `credential_issuance_audit?credential_id=eq.${correctionFirst}`,
      1,
    )
  ).data[0];
  assert.equal(audit.representative_id, uid(1));
  const old = (await correctionCredential(correctionOriginal, 1)).data[0],
    fresh = (await correctionCredential(correctionFirst, 1)).data[0];
  for (const key of ["recipient_id", "organization_id", "credential_type"])
    assert.equal(fresh[key], old[key]);
});
test("correction REST: unrelated users and recipients cannot initiate corrections or forge correction rows", async () => {
  const args = await correctionArgs(correctionOriginal);
  for (const role of [undefined, 2, 3])
    assert.ok(
      (await issuerRpc("correct_credential", args, role)).status >= 400,
    );
  for (const role of [undefined, 2, 3])
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const r = await fetch(
        `${base}/credential_corrections?replacement_id=eq.${correctionFirst}`,
        {
          method,
          headers: {
            ...(role ? { Authorization: `Bearer ${jwt(role)}` } : {}),
            "Content-Type": "application/json",
          },
          ...(method !== "DELETE"
            ? { body: JSON.stringify({ state: "accepted" }) }
            : {}),
        },
      );
      assert.ok(r.status >= 400);
    }
});
test("correction REST: pending replacement and private audit fields never leak through public REST", async () => {
  for (const role of [undefined, 3]) {
    assert.deepEqual(
      (await correctionCredential(correctionFirst, role)).data,
      [],
    );
    const raw = await read("credential_corrections?select=*", role);
    assert.ok(raw.status >= 400 || raw.data.length === 0);
    const safe = await read(
      `credential_correction_status?credential_id=eq.${correctionOriginal}`,
      role,
    );
    assert.equal(safe.status, 200);
    for (const row of safe.data) {
      assert.equal(row.pending_replacement_id, null);
      assert.equal(row.replacement_id, null);
      assert.ok(!("created_by" in row));
      assert.ok(!("reason" in row));
    }
  }
  assert.equal(
    (
      await read(
        `credential_corrections?replacement_id=eq.${correctionFirst}`,
        5,
      )
    ).data[0].reason,
    "PRIVATE correction investigation note",
  );
});
test("correction REST: decline preserves original and cannot later become accepted; a new proposal is allowed", async () => {
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionFirst,
          p_acceptance: "declined",
          p_public: false,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionFirst,
          p_acceptance: "accepted",
          p_public: false,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    400,
  );
  const s = (await correctionCredential(correctionOriginal, 2)).data[0]
    .credential_correction_status;
  assert.equal(s.superseded, false);
  const r = await issuerRpc(
    "correct_credential",
    await correctionArgs(correctionOriginal),
    1,
  );
  assert.equal(r.status, 200, JSON.stringify(r));
  correctionAccepted = r.data;
});
test("correction REST: accepted private replacement supersedes old record without disclosing replacement", async () => {
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionAccepted,
          p_acceptance: "accepted",
          p_public: false,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  // Existing original may be private; publish it explicitly for this boundary test.
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionOriginal,
          p_acceptance: "accepted",
          p_public: true,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  const old = (await correctionCredential(correctionOriginal)).data[0];
  assert.equal(old.credential_correction_status.superseded, true);
  assert.equal(old.credential_correction_status.replacement_id, null);
  assert.equal(
    (
      await issuerRpc("credential_replacement_tip", {
        p_credential: correctionOriginal,
      })
    ).data,
    null,
  );
  assert.deepEqual((await correctionCredential(correctionAccepted)).data, []);
  const { credentialClaim, credentialHash } =
    await import("../src/lib/credential-proof.ts");
  assert.equal(await credentialHash(credentialClaim(old)), originalClaimHash);
});
test("correction REST: publication enables safe lineage links, not audit details or private assessment", async () => {
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionAccepted,
          p_acceptance: "accepted",
          p_public: true,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  const old = (await correctionCredential(correctionOriginal)).data[0],
    fresh = (await correctionCredential(correctionAccepted)).data[0];
  assert.equal(
    old.credential_correction_status.replacement_id,
    correctionAccepted,
  );
  assert.equal(
    fresh.credential_correction_status.replaces_id,
    correctionOriginal,
  );
  assert.ok(
    !JSON.stringify(fresh).includes("PRIVATE correction investigation"),
  );
  const { workContext } = await import("../src/lib/challenge-assessment.ts");
  assert.equal(
    workContext(fresh.credential_challenge_context)?.assessment,
    null,
  );
});
test("correction REST: public replacement cannot disclose an unpublished predecessor ID", async () => {
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionOriginal,
          p_acceptance: "accepted",
          p_public: false,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  const c = (await correctionCredential(correctionAccepted)).data[0];
  assert.equal(c.credential_correction_status.replaces_id, null);
  assert.ok(!c.description.includes(correctionOriginal));
  assert.equal(
    (
      await issuerRpc("credential_replacement_tip", {
        p_credential: correctionOriginal,
      })
    ).data,
    null,
  );
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: correctionOriginal,
          p_acceptance: "accepted",
          p_public: true,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
});
test("correction REST: revoked original stays revoked; no correction may rewrite history or create loops", async () => {
  assert.equal(
    (
      await issuerRpc(
        "revoke_credential",
        {
          p_credential: correctionOriginal,
          p_reason: "Historical original explicitly revoked after correction.",
        },
        1,
      )
    ).status,
    204,
  );
  const { credentialValidity } = await import("../src/lib/credentials.ts");
  assert.equal(
    credentialValidity(
      (await correctionCredential(correctionOriginal)).data[0],
    ),
    "Revoked",
  );
  assert.equal(
    (
      await issuerRpc(
        "correct_credential",
        await correctionArgs(correctionOriginal),
        1,
      )
    ).status,
    400,
  );
  assert.equal(
    (await read(`credentials?id=eq.${correctionOriginal}`, 1, "PATCH")).status,
    403,
  );
});
test("correction REST: current category permission and issuer suspension apply to creation and acceptance", async () => {
  const args = await correctionArgs(correctionAccepted);
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 10);
  let r = await issuerRpc(
    "correct_credential",
    { ...args, p_issue_date: future.toISOString().slice(0, 10) },
    1,
  );
  assert.equal(r.status, 200, JSON.stringify(r));
  const futureId = r.data;
  const decide = (id) =>
    issuerRpc(
      "respond_credential",
      {
        p_credential: id,
        p_acceptance: "accepted",
        p_public: false,
        p_share_evidence: false,
      },
      2,
    );
  assert.equal((await decide(futureId)).status, 400);
  assert.equal(
    (
      await issuerRpc(
        "revoke_credential",
        {
          p_credential: futureId,
          p_reason:
            "Withdraw the future-dated proposal before issuing another.",
        },
        1,
      )
    ).status,
    204,
  );
  assert.equal((await decide(futureId)).status, 400);
  r = await issuerRpc("correct_credential", args, 1);
  assert.equal(r.status, 200, JSON.stringify(r));
  const pendingId = r.data;
  async function scope(types, authorize = true) {
    const org = (
      await read(
        `organizations?id=eq.${(await workArgs()).p_organization}&select=*`,
        1,
      )
    ).data[0];
    const v = await issuerRpc(
      "review_issuer_authorization",
      {
        p_organization: org.id,
        p_note: "Synthetic permission change for correction trust testing.",
        p_authorize: authorize,
        p_name: "Privacy Fixture",
        p_description: "Disposable local privacy test organization.",
        p_website: "https://example.com",
        p_types: types,
        p_expected_authorization: org.authorization_id,
      },
      5,
    );
    assert.equal(v.status, 204, JSON.stringify(v));
  }
  await scope(["workshop"]);
  assert.equal((await decide(pendingId)).status, 400);
  assert.equal(
    (
      await issuerRpc(
        "correct_credential",
        { ...args, p_original: futureId },
        1,
      )
    ).status,
    400,
  );
  await scope(["company_achievement"], false);
  assert.equal((await decide(pendingId)).status, 400);
  await scope(["company_achievement"]);
  assert.equal((await decide(pendingId)).status, 204);
  // Withdrawing acceptance cannot reactivate an old credential.
  assert.equal(
    (
      await issuerRpc(
        "respond_credential",
        {
          p_credential: pendingId,
          p_acceptance: "declined",
          p_public: false,
          p_share_evidence: false,
        },
        2,
      )
    ).status,
    204,
  );
  assert.equal(
    (await correctionCredential(correctionAccepted, 2)).data[0]
      .credential_correction_status.superseded,
    true,
  );
});

let handoffCompany,
  handoffRequest,
  handoffProject,
  handoffUnlinked,
  handoffDeclined,
  handoffWithdrawn;
const handoffDeadline = new Date(Date.now() + 30 * 86400000)
  .toISOString()
  .slice(0, 10);
async function handoffCreate(candidate, project = null) {
  const r = await issuerRpc(
    "create_contact_request",
    {
      p_company: handoffCompany,
      p_candidate: uid(candidate),
      p_purpose: "Discuss a practical next step with this organization.",
      p_paid_project: project,
    },
    3,
  );
  assert.equal(r.status, 200, JSON.stringify(r));
  return r.data;
}
async function handoffSend(
  request,
  role,
  nonce = crypto.randomUUID(),
  body = "Please suggest a convenient next step for this work.",
) {
  return issuerRpc(
    "send_contact_followup",
    { p_request: request, p_topic: "next_steps", p_body: body, p_nonce: nonce },
    role,
  );
}
async function handoffRespond(request, role, decision = "accepted") {
  return issuerRpc(
    "respond_contact_request",
    { p_request: request, p_decision: decision },
    role,
  );
}
test("handoff REST: accepted paid opportunity permits explicit next step and no automatic application", async () => {
  const org = await issuerRpc(
    "create_company",
    {
      p_name: "Handoff fixture organization",
      p_description: "An isolated organization for private contact testing.",
      p_website: "https://example.com",
      p_location: "Karachi",
    },
    3,
  );
  assert.equal(org.status, 200, JSON.stringify(org));
  handoffCompany = org.data;
  const project = await issuerRpc(
    "create_paid_project",
    {
      p_company: handoffCompany,
      p_title: "Handoff project fixture",
      p_description:
        "A synthetic paid project for private opportunity contact tests.",
      p_requirements: "Deliver an accessible interface and documented source.",
      p_skills: ["React"],
      p_deadline: handoffDeadline,
      p_budget: "1000000",
      p_milestones: [
        {
          title: "Deliver source",
          deliverables: "Source code and accessible interface documentation.",
          deadline: handoffDeadline,
          amount_units: "1000000",
        },
      ],
    },
    3,
  );
  assert.equal(project.status, 200, JSON.stringify(project));
  handoffProject = project.data;
  assert.equal(
    (await issuerRpc("publish_paid_project", { p_project: handoffProject }, 3))
      .status,
    204,
  );
  handoffRequest = await handoffCreate(30, handoffProject);
  assert.equal((await handoffSend(handoffRequest, 3)).status, 400);
  assert.equal((await handoffRespond(handoffRequest, 30)).status, 204);
  const op = await issuerRpc(
    "contact_request_opportunity",
    { p_request: handoffRequest },
    30,
  );
  assert.equal(op.status, 200);
  assert.equal(op.data.status, "Open");
  assert.equal(op.data.href, `/paid-projects/${handoffProject}`);
  assert.deepEqual(
    (await read(`paid_project_applications?project_id=eq.${handoffProject}`, 3))
      .data,
    [],
  );
});
test("handoff REST: original nonce retry is idempotent and changed content cannot reuse it", async () => {
  const nonce = crypto.randomUUID();
  const a = await handoffSend(handoffRequest, 3, nonce);
  assert.equal(a.status, 200, JSON.stringify(a));
  const replies = await Promise.all([
    handoffSend(handoffRequest, 3, nonce),
    handoffSend(handoffRequest, 3, nonce),
  ]);
  for (const r of replies) {
    assert.equal(r.status, 200);
    assert.equal(r.data, a.data);
  }
  assert.equal(
    (
      await handoffSend(
        handoffRequest,
        3,
        nonce,
        "Different content cannot reuse the same submission reference.",
      )
    ).status,
    400,
  );
  assert.equal((await handoffSend(handoffRequest, 30)).status, 200);
  const notes = await read(
    `visible_contact_followups?request_id=eq.${handoffRequest}`,
    30,
  );
  assert.equal(notes.data.length, 2);
  for (const n of notes.data) {
    assert.ok(!("created_by" in n));
    assert.ok(!("client_nonce" in n));
  }
});
test("handoff REST: anonymous, unrelated company, and unrelated candidate cannot read or write", async () => {
  for (const role of [undefined, 1, 31]) {
    const r = await read(
      `visible_contact_followups?request_id=eq.${handoffRequest}`,
      role,
    );
    assert.ok(r.status >= 400 || r.data.length === 0);
    assert.ok((await handoffSend(handoffRequest, role)).status >= 400);
    assert.ok(
      (
        await issuerRpc(
          "contact_request_opportunity",
          { p_request: handoffRequest },
          role,
        )
      ).status >= 400,
    );
  }
  assert.deepEqual(
    (await read(`contact_followups?request_id=eq.${handoffRequest}`, 30)).data,
    [],
  );
  assert.equal(
    (await read(`visible_contact_followups?select=created_by`, 30)).status,
    400,
  );
  for (const role of [3, 30, 1])
    for (const method of ["POST", "PATCH", "DELETE"])
      assert.ok((await read("contact_followups", role, method)).status >= 400);
  assert.ok(
    (await issuerRpc("close_contact_request", { p_request: handoffRequest }, 3))
      .status >= 400,
  );
});
test("handoff REST: closed opportunity is accurate and preserves private follow-up", async () => {
  assert.equal(
    (
      await issuerRpc(
        "change_paid_lifecycle",
        {
          p_project: handoffProject,
          p_action: "withdraw",
          p_reason:
            "Withdraw this synthetic opportunity while retaining contact history.",
        },
        3,
      )
    ).status,
    204,
  );
  const op = await issuerRpc(
    "contact_request_opportunity",
    { p_request: handoffRequest },
    30,
  );
  assert.equal(op.data.status, "Unavailable");
  assert.equal(op.data.title, null);
  assert.equal(op.data.href, null);
  assert.equal((await handoffSend(handoffRequest, 30)).status, 200);
});
test("handoff REST: accepted unlinked request has follow-up; declined and withdrawn requests cannot continue", async () => {
  handoffUnlinked = await handoffCreate(31);
  assert.equal((await handoffRespond(handoffUnlinked, 31)).status, 204);
  assert.equal(
    (
      await issuerRpc(
        "contact_request_opportunity",
        { p_request: handoffUnlinked },
        31,
      )
    ).data,
    null,
  );
  assert.equal((await handoffSend(handoffUnlinked, 31)).status, 200);
  handoffDeclined = await handoffCreate(32);
  assert.equal(
    (await handoffRespond(handoffDeclined, 32, "declined")).status,
    204,
  );
  assert.equal((await handoffSend(handoffDeclined, 3)).status, 400);
  handoffWithdrawn = await handoffCreate(33);
  assert.equal(
    (
      await issuerRpc(
        "close_contact_request",
        { p_request: handoffWithdrawn, p_withdraw: true },
        3,
      )
    ).status,
    204,
  );
  assert.equal((await handoffRespond(handoffWithdrawn, 33)).status, 400);
  assert.equal((await handoffSend(handoffWithdrawn, 3)).status, 400);
});
test("handoff REST: privacy withdrawal pauses access and closure permanently prevents reopening", async () => {
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: false, p_contact: false },
        31,
      )
    ).status,
    204,
  );
  assert.deepEqual(
    (
      await read(
        `visible_contact_followups?request_id=eq.${handoffUnlinked}`,
        3,
      )
    ).data,
    [],
  );
  assert.equal((await handoffSend(handoffUnlinked, 3)).status, 400);
  assert.equal((await handoffSend(handoffUnlinked, 31)).status, 400);
  assert.equal(
    (
      await issuerRpc(
        "close_contact_request",
        { p_request: handoffUnlinked },
        31,
      )
    ).status,
    204,
  );
  assert.equal(
    (
      await issuerRpc(
        "set_discovery_preferences",
        { p_discoverable: true, p_contact: true },
        31,
      )
    ).status,
    204,
  );
  assert.equal((await handoffRespond(handoffUnlinked, 31)).status, 400);
  assert.equal((await handoffSend(handoffUnlinked, 3)).status, 400);
  assert.equal(
    (
      await read(
        `visible_contact_followups?request_id=eq.${handoffUnlinked}`,
        31,
      )
    ).data.length,
    1,
  );
});
test("handoff REST: bounded exchange and per-actor daily limit resist direct RPC spam", async () => {
  for (let i = 0; i < 5; i++)
    assert.equal((await handoffSend(handoffRequest, 3)).status, 200);
  assert.equal((await handoffSend(handoffRequest, 3)).status, 400);
  let sent = 6,
    blocked = 0;
  for (const person of [20, 21, 22, 23]) {
    const r = await handoffCreate(person);
    assert.equal((await handoffRespond(r, person)).status, 204);
    for (let i = 0; i < 6; i++) {
      const v = await handoffSend(r, 3);
      if (sent < 20) {
        assert.equal(v.status, 200, JSON.stringify(v));
        sent++;
      } else {
        assert.equal(v.status, 400);
        blocked++;
      }
    }
  }
  assert.equal(sent, 20);
  assert.ok(blocked > 0);
});
test("handoff REST: concurrent send and candidate closure serialize; accepted organization withdrawal also ends contact", async () => {
  const request = await handoffCreate(24);
  assert.equal((await handoffRespond(request, 24)).status, 204);
  const [send, close] = await Promise.all([
    handoffSend(request, 24),
    issuerRpc("close_contact_request", { p_request: request }, 24),
  ]);
  assert.ok([200, 400].includes(send.status));
  assert.equal(close.status, 204);
  assert.equal((await handoffSend(request, 24)).status, 400);
  assert.equal((await handoffRespond(request, 24)).status, 400);
  const notes = (
    await read(`visible_contact_followups?request_id=eq.${request}`, 24)
  ).data;
  assert.equal(notes.length, send.status === 200 ? 1 : 0);
  assert.equal(
    (
      await issuerRpc(
        "close_contact_request",
        { p_request: handoffRequest, p_withdraw: true },
        3,
      )
    ).status,
    204,
  );
  assert.equal((await handoffSend(handoffRequest, 30)).status, 400);
  assert.equal((await handoffRespond(handoffRequest, 30)).status, 400);
  assert.ok(
    (
      await read(
        `visible_contact_followups?request_id=eq.${handoffRequest}`,
        30,
      )
    ).data.length > 0,
  );
});

let verificationOrg,
  verificationRequest,
  verificationScope,
  verificationPartnerRequest;
async function verificationOrgRecord() {
  return (await read(`organizations?id=eq.${verificationOrg}&select=*`, 1))
    .data[0];
}
async function submitVerification(assessment = false, role = 1) {
  return issuerRpc(
    "submit_organization_verification",
    {
      p_organization: verificationOrg,
      p_identity:
        "PRIVATE institutional identity and representative authority evidence.",
      p_role: "Training representative",
      p_identity_url: "https://example.com/PRIVATE-institutional-evidence",
      p_assessment: assessment
        ? "PRIVATE documented rubric, assessor qualifications and appeals policy."
        : "",
      p_assessment_url: assessment
        ? "https://example.com/PRIVATE-assessment-evidence"
        : "",
    },
    role,
  );
}
async function reviewVerification(
  decision,
  level,
  request,
  role = 5,
  checks = { identity: true, assessment: true },
) {
  const o = await verificationOrgRecord();
  return issuerRpc(
    "review_organization_verification",
    {
      p_organization: verificationOrg,
      p_request: request,
      p_expected_review: o.trust_review_id,
      p_decision: decision,
      p_level: level,
      p_reason:
        "PRIVATE administrator institutional evidence and assessment review.",
      p_identity_checked: checks.identity,
      p_assessment_checked: checks.assessment,
    },
    role,
  );
}
test("institutional trust REST: old authorized issuers remain self-registered, with no inferred identity status", async () => {
  verificationOrg = (await workArgs()).p_organization;
  const o = await verificationOrgRecord();
  assert.equal(o.trust_level, "self_registered");
  assert.equal(o.trust_suspended, false);
  verificationScope = {
    authorization_id: o.authorization_id,
    issuer_status: o.issuer_status,
    allowed_credential_types: o.allowed_credential_types,
  };
  const r = await submitVerification();
  assert.equal(r.status, 200, JSON.stringify(r));
  verificationRequest = r.data;
  assert.equal((await submitVerification()).status, 400);
});
test("institutional trust REST: verification evidence is private to members and admins, not the public or unrelated accounts", async () => {
  for (const role of [undefined, 2, 3]) {
    const r = await read(
      `organization_verification_requests?organization_id=eq.${verificationOrg}&select=*`,
      role,
    );
    assert.ok(r.status >= 400 || r.data.length === 0);
    const a = await read(
      `organization_verification_outcomes?organization_id=eq.${verificationOrg}&select=*`,
      role,
    );
    assert.ok(a.status >= 400 || a.data.length === 0);
    const q = await read("administrator_verification_queue?select=*", role);
    assert.ok(q.status >= 400 || q.data.length === 0);
  }
  for (const role of [1, 4, 5])
    assert.equal(
      (
        await read(
          `organization_verification_requests?id=eq.${verificationRequest}&select=*`,
          role,
        )
      ).data.length,
      1,
    );
  const publicOrg = (
    await read(`organizations?id=eq.${verificationOrg}&select=*`)
  ).data[0];
  assert.ok(!JSON.stringify(publicOrg).includes("PRIVATE"));
  assert.ok(!("verification_request_id" in publicOrg));
  assert.equal(
    (await read(`administrator_verification_queue?id=eq.${verificationOrg}`, 5))
      .data.length,
    1,
  );
});
test("institutional trust REST: member, outsider, anonymous and direct API writes cannot approve trust", async () => {
  for (const role of [0, 1, 2, 3, 4, 5]) {
    const r = await fetch(`${base}/organizations?id=eq.${verificationOrg}`, {
      method: "PATCH",
      headers: {
        ...(role ? { Authorization: `Bearer ${jwt(role)}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trust_level: "trusted_assessment_partner",
        trust_suspended: false,
      }),
    });
    assert.ok(
      [401, 403].includes(r.status),
      `Valid-column direct trust PATCH role ${role}: ${r.status}`,
    );
  }
  for (const role of [0, 1, 2, 3, 4])
    assert.ok(
      (
        await reviewVerification(
          "approve",
          "verified_organization",
          verificationRequest,
          role,
        )
      ).status >= 400,
    );
  for (const role of [1, 3, 5])
    for (const table of [
      "organizations",
      "organization_verification_requests",
      "issuer_authorizations",
    ])
      for (const method of ["POST", "PATCH", "DELETE"])
        assert.ok((await read(table, role, method)).status >= 400);
});
test("institutional trust REST: identity and assessment confirmations are separately enforced", async () => {
  assert.equal(
    (
      await reviewVerification(
        "approve",
        "trusted_assessment_partner",
        verificationRequest,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await reviewVerification(
        "approve",
        "verified_organization",
        verificationRequest,
        5,
        { identity: false, assessment: false },
      )
    ).status,
    400,
  );
  const attempts = await Promise.all([
    reviewVerification("approve", "verified_organization", verificationRequest),
    reviewVerification("approve", "verified_organization", verificationRequest),
  ]);
  assert.deepEqual(
    attempts.map((r) => r.status).sort(),
    [204, 400],
    JSON.stringify(attempts),
  );
  const o = await verificationOrgRecord();
  assert.equal(o.trust_level, "verified_organization");
  const { organizationTrust } =
    await import("../src/lib/organization-trust.ts");
  assert.equal(
    organizationTrust(
      (await read(`organizations?id=eq.${verificationOrg}&select=*`)).data[0],
    ).label,
    "Verified Organization",
  );
  assert.equal(o.authorization_id, verificationScope.authorization_id);
  assert.deepEqual(
    o.allowed_credential_types,
    verificationScope.allowed_credential_types,
  );
  assert.equal(
    (await read(`administrator_verification_queue?id=eq.${verificationOrg}`, 5))
      .data.length,
    0,
  );
  assert.equal(
    (
      await reviewVerification(
        "approve",
        "verified_organization",
        verificationRequest,
      )
    ).status,
    400,
  );
});
test("institutional trust REST: partner approval, downgrade and suspension retain scopes and immutable private history", async () => {
  let r = await submitVerification(true);
  assert.equal(r.status, 200, JSON.stringify(r));
  verificationPartnerRequest = r.data;
  assert.equal(
    (
      await reviewVerification(
        "approve",
        "trusted_assessment_partner",
        verificationPartnerRequest,
        5,
        { identity: true, assessment: false },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await reviewVerification(
        "approve",
        "trusted_assessment_partner",
        verificationPartnerRequest,
      )
    ).status,
    204,
  );
  let o = await verificationOrgRecord();
  const stale = o.trust_review_id;
  assert.equal(o.trust_level, "trusted_assessment_partner");
  assert.equal(
    (await reviewVerification("downgrade", "verified_organization", null))
      .status,
    204,
  );
  r = await issuerRpc(
    "review_organization_verification",
    {
      p_organization: verificationOrg,
      p_request: null,
      p_expected_review: stale,
      p_decision: "suspend",
      p_level: "self_registered",
      p_reason: "A stale review should never overwrite another decision.",
      p_identity_checked: false,
      p_assessment_checked: false,
    },
    5,
  );
  assert.equal(r.status, 400);
  assert.equal(
    (await reviewVerification("suspend", "self_registered", null)).status,
    204,
  );
  o = await verificationOrgRecord();
  assert.equal(o.trust_level, "self_registered");
  assert.equal(o.trust_suspended, true);
  for (const k of Object.keys(verificationScope))
    assert.deepEqual(o[k], verificationScope[k]);
  const audit = (
    await read(
      `issuer_authorizations?organization_id=eq.${verificationOrg}&trust_decision=not.is.null&select=*`,
      5,
    )
  ).data;
  assert.equal(audit.length, 4);
  assert.ok(audit.every((a) => a.administrator_id === uid(5)));
  const outcomes = (
    await read(
      `organization_verification_outcomes?organization_id=eq.${verificationOrg}`,
      1,
    )
  ).data;
  assert.equal(outcomes.length, 4);
  assert.ok(!JSON.stringify(outcomes).includes("PRIVATE"));
  assert.ok(
    outcomes.every((a) => !("administrator_id" in a) && !("review_note" in a)),
  );
});
test("institutional trust REST: rejection retains current trust, category permissions still control issuance and historic v3 hashes stay intact", async () => {
  const { credentialClaim, credentialHash } =
    await import("../src/lib/credential-proof.ts");
  const record = (await correctionCredential(correctionAccepted, 1)).data[0];
  const hash = await credentialHash(credentialClaim(record));
  const r = await submitVerification();
  assert.equal(r.status, 200);
  assert.equal(
    (await reviewVerification("reject", "trusted_assessment_partner", r.data))
      .status,
    204,
  );
  assert.equal((await verificationOrgRecord()).trust_level, "self_registered");
  assert.equal((await verificationOrgRecord()).trust_suspended, true);
  assert.equal((await submitVerification()).status, 400);
  const args = await issueArgs("company_achievement");
  assert.equal((await issuerRpc("issue_credential", args, 1)).status, 200);
  assert.equal(
    (await issuerRpc("issue_credential", { ...args, p_type: "degree" }, 1))
      .status,
    400,
  );
  const same = (await correctionCredential(correctionAccepted, 1)).data[0];
  assert.equal(await credentialHash(credentialClaim(same)), hash);
});
