import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=credential";
test("credential presents the actual facts, with separate checks and collapsed metadata", async ({
  page,
}) => {
  await page.goto(fixture);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Frontend Development Completion",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Illustrative Recipient" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Illustrative Learning Organization" }),
  ).toBeVisible();
  await expect(
    page.getByText("15 January 2025", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Completed a practical interface project", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Organization website" }),
  ).toHaveAttribute("href", "https://example.com/");
  const checks = page.getByRole("region", { name: "Four separate checks" });
  for (const label of [
    "Credential validity",
    "Recipient decision",
    "Organization approval",
    "Blockchain integrity",
  ])
    await expect(checks.getByText(label, { exact: true })).toBeVisible();
  await expect(checks.getByText("Not recorded", { exact: true })).toBeVisible();
  await expect(
    page.getByText("70000000-0000-4000-8000-000000000001", { exact: true }),
  ).not.toBeVisible();
  await page.getByText("Technical details", { exact: true }).click();
  await expect(
    page.getByText("70000000-0000-4000-8000-000000000001", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('a[href*="private-fixture-evidence"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByText("private-fixture-salt", { exact: true }),
  ).toHaveCount(0);
});
test("acceptance and both publication controls independently hide sharing", async ({
  page,
}) => {
  await page.goto(fixture);
  for (const decision of ["pending", "declined"]) {
    await page.getByLabel("Fixture recipient decision").selectOption(decision);
    await expect(
      page.getByRole("button", { name: "Copy Credential Link" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Private record", { exact: false }),
    ).toBeVisible();
  }
  await page.getByLabel("Fixture recipient decision").selectOption("accepted");
  await page.getByLabel("Fixture credential public").uncheck();
  await expect(
    page.getByRole("button", { name: "Copy Credential Link" }),
  ).toHaveCount(0);
  await page.getByLabel("Fixture credential public").check();
  await page.getByLabel("Fixture passport public").uncheck();
  await expect(
    page.getByRole("button", { name: "Copy Credential Link" }),
  ).toHaveCount(0);
  await page.getByLabel("Fixture passport public").check();
  await expect(
    page.getByRole("button", { name: "Copy Credential Link" }),
  ).toBeVisible();
});
test("revocation, expiry, organization approval and integrity remain independent", async ({
  page,
}) => {
  await page.goto(fixture);
  const checks = page.getByRole("region", { name: "Four separate checks" });
  await page.getByLabel("Fixture transaction recorded").check();
  await expect(
    checks.getByText("Awaiting finalization", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fixture integrity").selectOption("verified");
  await expect(
    checks.getByText("Onchain verified", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fixture validity").selectOption("revoked");
  await expect(checks.getByText("Revoked", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("note", { name: "Credential validity alert" }),
  ).toContainText("Revoked credential");
  await expect(
    page.getByText("Offline fixture: the issuer withdrew", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Fixture organization approval")
    .selectOption("suspended");
  await expect(
    checks.getByText("Suspended on ProofPak", { exact: true }),
  ).toBeVisible();
  await expect(
    checks.getByText("ProofPak approval recorded at issuance."),
  ).toBeVisible();
  await expect(
    checks.getByText("Onchain verified", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fixture validity").selectOption("expired");
  await expect(checks.getByText("Expired", { exact: true })).toBeVisible();
  for (const state of [
    "pending",
    "failed",
    "unavailable",
    "mismatch",
    "missing",
  ]) {
    await page.getByLabel("Fixture integrity").selectOption(state);
    await expect(
      checks.getByText("Onchain verified", { exact: true }),
    ).toHaveCount(0);
  }
});
test("copy uses this site's actual public credential route; clipboard failure has a usable fallback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(fixture);
  await page.getByRole("button", { name: "Copy Credential Link" }).click();
  await expect(page.getByRole("status")).toHaveText("Credential link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "http://127.0.0.1:3100/credentials/70000000-0000-4000-8000-000000000001",
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
    });
  });
  await page.getByRole("button", { name: "Copy Credential Link" }).click();
  await expect(page.getByLabel("Public credential link")).toHaveValue(
    "http://127.0.0.1:3100/credentials/70000000-0000-4000-8000-000000000001",
  );
});
for (const width of [320, 390, 1280]) {
  test(`credential fits ${width}px without technical metadata taking over`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator(".credential-detail").screenshot({
      path: `test-results/credential-detail-${width}-${test.info().project.name}.png`,
    });
  });
}
test("an anonymous context cannot load a private/unconfigured credential through the real route", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(
    "http://127.0.0.1:3100/credentials/70000000-0000-4000-8000-000000000001",
  );
  await expect(
    page.getByRole("heading", { name: "This page isn’t available." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy Credential Link" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Illustrative Recipient", { exact: true }),
  ).toHaveCount(0);
  await context.close();
});
