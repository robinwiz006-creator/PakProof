import { test, expect } from "@playwright/test";
test("section loading, empty and unavailable states retain successful content and offer real retry", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=task21");
  await expect(
    page.getByRole("heading", { name: "Available project" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  const request = page.waitForRequest((r) => r.headers()["rsc"] === "1");
  await page.getByRole("button", { name: "Check again" }).click();
  await request;
  await page.getByLabel("Fixture state").selectOption("empty");
  await expect(
    page.getByText("No records are shared in this section."),
  ).toBeVisible();
  await page.getByLabel("Fixture state").selectOption("loading");
  await expect(
    page.getByRole("region", { name: "Credentials" }),
  ).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("heading", { name: "Available project" }),
  ).toBeVisible();
});
test("organization registration, identity review and category authorization stay separate", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=task21");
  await expect(
    page.getByRole("link", { name: "Issue a credential", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Manage opportunities" }),
  ).toHaveAttribute("href", "/portal/company?company=company");
  await page.getByLabel("Fixture state").selectOption("verified");
  await expect(
    page.getByText("Verified Organization", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Issue a credential", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Fixture state").selectOption("approved");
  await expect(
    page.getByRole("link", { name: "Issue a credential", exact: true }),
  ).toHaveAttribute("href", "/organizations?view=issue");
  await page.getByLabel("Fixture state").selectOption("university");
  await expect(
    page.getByRole("link", { name: "Edit organization profile" }),
  ).toHaveCount(0);
});
for (const width of [320, 390, 1280])
  test(`Passport errors and organization steps fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-ui?fixture=task21");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Check again" }).focus();
    await expect(
      page.getByRole("button", { name: "Check again" }),
    ).toBeFocused();
  });
