import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=credential";
test("a matching historical proof never makes revoked, expired or superseded credentials active", async ({
  page,
}) => {
  await page.goto(fixture);
  const summary = page.getByRole("region", {
    name: "Credential status summary",
  });
  await page.getByLabel("Fixture transaction recorded").check();
  await page.getByLabel("Fixture integrity").selectOption("verified");
  await expect(summary.getByText("Active", { exact: true })).toBeVisible();
  await expect(
    summary.getByText("Onchain verified", { exact: true }),
  ).toBeVisible();
  for (const [value, label] of [
    ["revoked", "Revoked"],
    ["expired", "Expired"],
    ["future", "Not yet valid"],
  ]) {
    await page.getByLabel("Fixture validity").selectOption(value);
    await expect(summary.getByText(label, { exact: true })).toBeVisible();
    await expect(summary.getByText("Active", { exact: true })).toHaveCount(0);
    await expect(
      summary.getByText("Onchain verified", { exact: true }),
    ).toBeVisible();
  }
  await page.getByLabel("Fixture validity").selectOption("current");
  await page
    .getByLabel("Correction fixture")
    .selectOption("superseded-private");
  await expect(summary.getByText("Superseded", { exact: true })).toBeVisible();
  await expect(
    summary.getByText("Onchain verified", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View current replacement ↗" }),
  ).toHaveCount(0);
});
test("pending/declined records are private and owner-only, never described as active", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel("Fixture recipient decision").selectOption("pending");
  await expect(
    page.getByRole("heading", { name: "Credential not public" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Frontend Development Completion" }),
  ).toHaveCount(0);
  await page.getByLabel("Fixture owner access").check();
  const summary = page.getByRole("region", {
    name: "Credential status summary",
  });
  await expect(
    summary.getByText("Awaiting acceptance", { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText("Active", { exact: true })).toHaveCount(0);
  await page.getByLabel("Fixture recipient decision").selectOption("declined");
  await expect(
    summary.locator(".credential-status").filter({ hasText: /^Declined$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy Credential Link" }),
  ).toHaveCount(0);
});
test("current issuer trust and permission changes do not revoke accepted historical records", async ({
  page,
}) => {
  await page.goto(fixture);
  const summary = page.getByRole("region", {
    name: "Credential status summary",
  });
  await page
    .getByLabel("Fixture institutional trust")
    .selectOption("trusted_assessment_partner");
  await expect(
    summary.getByText("Trusted Assessment Partner", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Fixture institutional suspension").check();
  await page
    .getByLabel("Fixture organization approval")
    .selectOption("suspended");
  await expect(
    summary.getByText("Self-registered", { exact: true }),
  ).toBeVisible();
  await expect(summary.getByText("Active", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "This does not automatically revoke previously issued credentials.",
      { exact: false },
    ),
  ).toBeVisible();
});
test("public recheck needs no wallet or login and does not invoke transaction APIs", async ({
  page,
}) => {
  let writes = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/") && request.method() !== "GET") writes++;
  });
  await page.goto(fixture);
  await page
    .getByRole("button", { name: "Recheck current status", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recheck current status", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText(
      "No account or wallet is needed for a publicly shared credential.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(writes).toBe(0);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
