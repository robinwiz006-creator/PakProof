import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=dashboard-attention";
test("action rows provide status and a real workflow link, with role-specific destinations", async ({
  page,
}) => {
  await page.goto(fixture);
  const section = page.getByRole("region", { name: "Needs your attention" });
  await expect(
    section.getByRole("heading", { name: "Review received credentials 2" }),
  ).toBeVisible();
  await expect(section.getByText("Your decision needed")).toBeVisible();
  await expect(
    section.getByRole("link", { name: "Review credentials" }),
  ).toHaveAttribute("href", "/my-credentials");
  await page.getByLabel("Attention fixture state").selectOption("company");
  await expect(section).toContainText("Fixture organization");
  await expect(
    section.getByRole("link", { name: "Review milestones" }),
  ).toHaveAttribute("href", "/paid-projects?view=company");
  await expect(
    section.getByRole("link", { name: "Review credentials" }),
  ).toHaveCount(0);
});
test("loading, empty, all-error and partial-error states are distinct", async ({
  page,
}) => {
  await page.goto(fixture);
  const state = page.getByLabel("Attention fixture state");
  await state.selectOption("loading");
  const loading = page.getByRole("region", { name: "Needs your attention" });
  await expect(loading).toHaveAttribute("aria-busy", "true");
  await expect(loading.getByRole("status")).toContainText(
    "Checking your actions",
  );
  await expect(loading.locator(".attention-count")).toHaveCount(0);
  await state.selectOption("empty");
  await expect(
    page.getByText("No pending actions in the workflows checked here.", {
      exact: false,
    }),
  ).toBeVisible();
  await state.selectOption("partial");
  await expect(
    page.getByRole("link", { name: "Review credentials" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Project offers");
  await expect(
    page.getByText("No pending actions in the workflows checked here.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  const refreshed = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/test-ui" &&
      request.headers()["rsc"] === "1",
  );
  await page.getByRole("button", { name: "Check again" }).click();
  await refreshed;
  await expect(
    page.getByRole("link", { name: "Review credentials" }),
  ).toBeVisible();
  await state.selectOption("unavailable");
  await expect(page.getByRole("status")).toContainText(
    "This does not mean there are no pending actions.",
  );
  await expect(
    page.getByText("No pending actions in the workflows checked here.", {
      exact: false,
    }),
  ).toHaveCount(0);
});
for (const width of [320, 390, 1280])
  test(`attention stays compact and keyboard-accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture);
    await page.getByLabel("Attention fixture state").selectOption("partial");
    const link = page.getByRole("link", { name: "Review credentials" });
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/attention-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
test("read-only demo dashboards do not fabricate pending records and admin still requires authentication", async ({
  page,
}) => {
  await page.goto("/portal/talent");
  await expect(
    page.getByRole("region", { name: "Needs your attention" }),
  ).toHaveCount(0);
  await page.goto("/portal/company");
  await expect(
    page.getByRole("region", { name: "Needs your attention" }),
  ).toHaveCount(0);
  await page.goto("/issuer-admin");
  await expect(page).toHaveURL(/\/sign-in/);
});
