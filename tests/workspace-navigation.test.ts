import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { WorkspaceFrame } from "../src/components/workspace-frame";
import { IssuerQueue } from "../src/components/issuer-queue";
function frame(path: string) {
  return renderToStaticMarkup(
    createElement(
      PathnameContext.Provider,
      { value: path },
      createElement(WorkspaceFrame, null, "Isolated presentation fixture"),
    ),
  );
}
test("shared workspace navigation preserves destinations without duplicating portal or marketing layouts", () => {
  const wallet = frame("/wallet");
  assert.ok(wallet.includes('aria-label="Workspace navigation"'));
  assert.ok(wallet.includes('href="/portal/talent/passport"'));
  assert.ok(wallet.includes('href="/payments"'));
  assert.ok(!frame("/").includes('aria-label="Workspace navigation"'));
  assert.ok(
    !frame("/portal/talent").includes('aria-label="Workspace navigation"'),
  );
  assert.ok(frame("/issuer-admin/example").includes("Issuer review queue"));
});
test("issuer queue displays actual status/date, links to detail, and contains no private audit or inline approval form", () => {
  const html = renderToStaticMarkup(
    createElement(IssuerQueue, {
      organizations: [
        {
          id: "test-org",
          company_id: "test-company",
          organization_type: "other",
          issuer_status: "pending",
          authorization_id: null,
          created_at: "2026-10-13T01:00:00Z",
          companies: {
            name: "UI fixture organization",
            description: "Fixture only",
            website: "",
          },
        },
      ],
    }),
  );
  assert.ok(html.includes('href="/issuer-admin/test-org"'));
  assert.ok(html.includes("pending"));
  assert.ok(html.includes("2026-10-13"));
  assert.ok(!html.includes("textarea"));
  assert.ok(!html.includes("review_note"));
  assert.ok(!html.includes("authorized</span>"));
});

test("client project listings strip private references even if a source row contains them", async () => {
  const { projectListing } =
    await import("../src/lib/opportunity-presentation");
  const result = projectListing({
    id: "fixture",
    title: "Fixture listing",
    description: "Not a real project",
    skills: ["TypeScript"],
    deadline: "2026-12-01",
    budget_units: "10000000",
    status: "published",
    companies: { name: "Fixture company" },
    worker_id: "private-worker",
    current_offer_id: "private-offer",
    payout_authorization_id: "private-payout",
    requirements: "private-contract",
  } as Parameters<typeof projectListing>[0]);
  assert.deepEqual(
    Object.keys(result).sort(),
    [
      "id",
      "title",
      "description",
      "skills",
      "deadline",
      "budget_units",
      "status",
      "companies",
    ].sort(),
  );
  assert.ok(!JSON.stringify(result).includes("private-"));
});
