import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLiveOpportunities } from "../src/lib/live-opportunities";

function fixture(errorTable?: string) {
  const calls: {
    table: string;
    fields?: string;
    filters: string[];
    limit?: number;
  }[] = [];
  const db = {
    from(table: string) {
      const call = { table, filters: [] as string[], fields: "", limit: 0 };
      calls.push(call);
      const query = {
        select(fields: string) {
          call.fields = fields;
          return query;
        },
        eq(field: string, value: string) {
          call.filters.push(`${field}=${value}`);
          return query;
        },
        gte(field: string, value: string) {
          call.filters.push(`${field}>=${value}`);
          return query;
        },
        order() {
          return query;
        },
        limit(count: number) {
          call.limit = count;
          return Promise.resolve({
            data:
              errorTable === table
                ? null
                : [
                    {
                      id: `${table}-fixture`,
                      title: "Clearly labeled test fixture",
                      skills: ["TypeScript"],
                      deadline: "2026-10-30",
                      companies: { name: "Test organization" },
                      ...(table === "paid_projects"
                        ? { budget_units: "1000001" }
                        : {}),
                    },
                  ],
            error: errorTable === table ? { code: "42501" } : null,
          });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
test("homepage reads bounded published opportunity metadata, never private relations", async () => {
  const { db, calls } = fixture();
  const result = await loadLiveOpportunities(db, "2026-10-13");
  assert.equal(result.challenges.items.length, 1);
  assert.equal(result.projects.items[0].budget_units, "1000001");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.deepEqual(call.filters, [
      "status=published",
      "deadline>=2026-10-13",
    ]);
    assert.equal(call.limit, 3);
    assert.ok(!call.fields?.includes("*"));
    assert.ok(
      !/profiles|applications|offers|credentials|wallet|submissions/.test(
        call.fields!,
      ),
    );
  }
  assert.equal(calls[0].fields?.includes("budget"), false);
});
test("a failed paid-project query preserves successful challenges and is not an empty success", async () => {
  const { db } = fixture("paid_projects");
  const result = await loadLiveOpportunities(db);
  assert.equal(result.challenges.unavailable, false);
  assert.equal(result.challenges.items.length, 1);
  assert.equal(result.projects.unavailable, true);
  assert.deepEqual(result.projects.items, []);
});
test("unconfigured homepage has no fabricated live fallback", async () => {
  const result = await loadLiveOpportunities(null);
  assert.deepEqual(result.challenges.items, []);
  assert.deepEqual(result.projects.items, []);
});
test("network exceptions produce honest unavailable states", async () => {
  const db = {
    from() {
      throw new Error("Offline fixture");
    },
  } as unknown as SupabaseClient;
  const result = await loadLiveOpportunities(db);
  assert.equal(result.challenges.unavailable, true);
  assert.equal(result.projects.unavailable, true);
});

test("real listing presentation keeps routes, payment types, amounts and failures distinct", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { OpportunityList } =
    await import("../src/components/opportunity-list");
  const { db } = fixture();
  const results = await loadLiveOpportunities(db);
  const html = renderToStaticMarkup(
    createElement(OpportunityList, { ...results, configured: true }),
  );
  assert.ok(html.includes('href="/challenges/challenges-fixture"'));
  assert.ok(html.includes('href="/paid-projects/paid_projects-fixture"'));
  assert.ok(html.includes("Unpaid challenge"));
  assert.ok(html.includes("Paid project · devnet"));
  assert.ok(html.includes("1.000001 test USDC"));
  assert.ok(!html.includes("Onchain Verified"));
  const partial = renderToStaticMarkup(
    createElement(OpportunityList, {
      ...results,
      projects: { items: [], unavailable: true },
      configured: true,
    }),
  );
  assert.ok(partial.includes("Paid projects could not be loaded"));
  assert.ok(partial.includes('href="/challenges/challenges-fixture"'));
  assert.ok(!partial.includes("No open paid projects right now"));
});

test("discovery queries at most 100 per type with public descriptions while homepage remains small", async () => {
  const { db, calls } = fixture();
  await loadLiveOpportunities(db, "2026-10-20", true);
  for (const call of calls) {
    assert.equal(call.limit, 100);
    assert.ok(call.fields?.includes("description"));
    assert.ok(
      !/\*|profiles|applications|offers|wallet|submissions/.test(call.fields!),
    );
    assert.deepEqual(call.filters, [
      "status=published",
      "deadline>=2026-10-20",
    ]);
  }
});
