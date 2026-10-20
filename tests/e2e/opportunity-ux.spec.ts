import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=opportunities";
test("discovery search and type filters show only matching real-shape fixture cards", async ({
  page,
}) => {
  await page.goto(fixture);
  const grid = page.locator(".discovery-grid");
  await expect(grid.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Challenges", exact: true }).click();
  await expect(grid.getByRole("article")).toHaveCount(1);
  await expect(grid).toContainText("Unpaid challenge");
  await expect(grid.locator("a").first()).toHaveAttribute(
    "href",
    "/challenges/90000000-0000-4000-8000-000000000002",
  );
  await page
    .getByRole("button", { name: "Paid Projects", exact: true })
    .click();
  await expect(grid).toContainText("125.000001 test USDC");
  await expect(grid.locator("a").first()).toHaveAttribute(
    "href",
    "/paid-projects/90000000-0000-4000-8000-000000000001",
  );
  await page.getByLabel("Search opportunities").fill("SQL");
  await expect(
    page.getByRole("heading", { name: "No matching opportunities" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Search opportunities").fill("Design React");
  await expect(grid.getByRole("article")).toHaveCount(1);
  await expect(grid).toContainText("accessible dashboard");
});
test("empty, disconnected and partial failures remain distinct without invented listings", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel("Fixture listing state").selectOption("empty");
  await expect(
    page.getByRole("heading", { name: "No open opportunities yet" }),
  ).toBeVisible();
  await expect(page.locator(".discovery-grid article")).toHaveCount(0);
  await page.getByLabel("Fixture listing state").selectOption("unavailable");
  await expect(
    page.getByText("Opportunities aren’t available right now.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No open opportunities yet" }),
  ).toHaveCount(0);
  await page.getByLabel("Fixture listing state").selectOption("partial");
  await expect(
    page.getByText("Paid projects could not be loaded.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".discovery-grid article")).toHaveCount(1);
  await expect(page.locator(".discovery-grid")).toContainText("data challenge");
});
test("Apply opens the original field contract, preserves cancelled input and validates before fixture submission", async ({
  page,
}) => {
  await page.goto(fixture);
  await expect(page.getByLabel("Your approach")).not.toBeVisible();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Apply for this project" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Send application" }).click();
  await expect(
    page.getByText("Offline application captured:", { exact: false }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Your approach")
    .fill(
      "I will deliver an accessible tested React dashboard with source and documentation.",
    );
  await dialog.getByLabel("Project or evidence URL").fill("not-a-url");
  await dialog.getByRole("button", { name: "Send application" }).click();
  expect(
    await dialog
      .getByLabel("Project or evidence URL")
      .evaluate((e) => (e as HTMLInputElement).validity.typeMismatch),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(dialog.getByLabel("Your approach")).toHaveValue(
    /accessible tested React/,
  );
  await dialog
    .getByLabel("Project or evidence URL")
    .fill("https://example.com/portfolio");
  await dialog.getByRole("button", { name: "Send application" }).click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Offline application captured:" }),
  ).toContainText("90000000-0000-4000-8000-000000000001");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Offline application captured:" }),
  ).toContainText("https://example.com/portfolio");
});
test("visitors, company members, previous applicants and closed projects cannot open an application", async ({
  page,
}) => {
  await page.goto(fixture);
  for (const role of ["visitor", "company", "applied", "closed"]) {
    await page.getByLabel("Fixture applicant context").selectOption(role);
    await expect(
      page.getByRole("button", { name: "Apply", exact: true }),
    ).toHaveCount(0);
  }
  await page.getByLabel("Fixture applicant context").selectOption("visitor");
  await expect(
    page.getByRole("link", { name: "Sign in to apply" }),
  ).toHaveAttribute("href", "/sign-in");
});
for (const width of [320, 390, 1280]) {
  test(`opportunities, project brief and application dialog fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Fixture: accessible dashboard",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/opportunity-ux-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/application-dialog-${width}-${test.info().project.name}.png`,
    });
  });
}
test("How It Works has three steps, one primary CTA and expandable trust information", async ({
  page,
}) => {
  await page.goto("/how-it-works");
  await expect(page.locator(".simple-steps > li")).toHaveCount(3);
  await expect(
    page.getByRole("link", { name: "Create my Skill Passport" }),
  ).toHaveAttribute("href", "/sign-up?role=talent");
  await expect(
    page
      .getByRole("link", { name: "For organizations", exact: false })
      .filter({ hasText: "For organizations →" }),
  ).toHaveAttribute("href", "/sign-up?role=company");
  await page.getByText("Trust & Verification", { exact: true }).click();
  await expect(
    page.getByText("Solana devnet is a test network", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Payment alone does not verify a skill", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
