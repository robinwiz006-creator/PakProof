import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=organization-verification";
test("public trust levels distinguish identity from assessment review and suspension removes trusted claims", async ({
  page,
}) => {
  await page.goto(fixture);
  await expect(
    page.locator(".tag").filter({ hasText: "Self-registered" }),
  ).toBeVisible();
  await page
    .getByLabel("Fixture trust level")
    .selectOption("verified_organization");
  await expect(
    page.getByText("Assessment standards are not reviewed by this level.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Fixture trust level")
    .selectOption("trusted_assessment_partner");
  await expect(
    page.locator(".tag").filter({ hasText: "Trusted Assessment Partner" }),
  ).toBeVisible();
  await page.getByLabel("Fixture suspension").check();
  await expect(
    page.locator(".tag").filter({ hasText: "Verification suspended" }),
  ).toBeVisible();
  await expect(
    page.locator(".tag").filter({ hasText: "Trusted Assessment Partner" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("This does not guarantee every credential", {
      exact: false,
    }),
  ).toBeVisible();
});
test("organization submits bounded institutional evidence without collecting document uploads", async ({
  page,
}) => {
  await page.goto(fixture);
  await page
    .getByText("Request organization verification", { exact: true })
    .click();
  await expect(
    page.getByText("Do not submit identity documents", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await page
    .getByLabel("Institutional identity and representative authority", {
      exact: true,
    })
    .fill(
      "Our official institutional information and representative authority.",
    );
  await page
    .getByLabel("Your role in the organization", { exact: true })
    .fill("Director");
  await page
    .getByLabel("Institutional evidence URL (HTTPS)", { exact: true })
    .fill("https://example.com/evidence");
  await page
    .getByRole("button", { name: "Submit for independent review" })
    .click();
  await expect(
    page.getByText("Offline submission captured; no trust was granted."),
  ).toBeVisible();
  await expect(
    page.locator(".tag").filter({ hasText: "Self-registered" }),
  ).toBeVisible();
});
test("administrator confirms an explicit decision and sees that categories remain separate", async ({
  page,
}) => {
  await page.goto(fixture);
  await page
    .getByLabel("Institutional trust decision", { exact: true })
    .selectOption("approve");
  await page
    .getByLabel("Target trust level", { exact: true })
    .selectOption("trusted_assessment_partner");
  await page
    .getByLabel(
      "I checked current institutional identity and representative authority.",
    )
    .check();
  await page
    .getByLabel(
      "I separately checked assessment standards and supporting evidence.",
    )
    .check();
  await page
    .getByLabel("Private administrator decision reason", { exact: true })
    .fill("Institutional authority and assessment standards were reviewed.");
  await page
    .getByRole("button", { name: "Review and confirm trust decision" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Offline decision captured:", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Review and confirm trust decision" })
    .click();
  await dialog
    .getByRole("button", { name: "Record trust decision", exact: true })
    .click();
  await expect(
    page.getByText(
      "Offline decision captured: approve. No real trust changed.",
    ),
  ).toBeVisible();
});
test("institutional verification forms fit small mobile screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixture);
  await page
    .getByText("Request organization verification", { exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
