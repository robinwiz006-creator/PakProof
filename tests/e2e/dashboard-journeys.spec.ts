import { test, expect } from "@playwright/test";
for (const width of [320, 390, 1280]) {
  test(`new user can find profile setup, publishing and opportunities at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/portal/talent");
    const nav = page.getByRole("navigation", { name: "Portal navigation" });
    await expect(nav.getByRole("link")).toHaveCount(5);
    for (const label of [
      "Home",
      "My Profile",
      "Opportunities",
      "My Activity",
      "Credentials",
    ])
      await expect(
        nav.getByRole("link", { name: label, exact: true }),
      ).toBeInViewport({ ratio: 0.9 });
    await page.screenshot({
      path: `test-results/dashboard-home-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page
      .locator(".dashboard-actions")
      .getByRole("link", { name: /Build my profile/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "About me", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Full name", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Profile visibility")).not.toBeVisible();
    await page.getByRole("link", { name: "Skip for now" }).click();
    await expect(
      page.getByRole("heading", { name: "My skills", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "2 My skills" }),
    ).toHaveAttribute("aria-current", "step");
    await page.getByRole("link", { name: "Skip for now" }).click();
    await expect(
      page.getByRole("heading", { name: "My work and projects", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Skip projects for now" }).click();
    await expect(page.getByLabel("Profile visibility")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save visibility" }),
    ).not.toBeVisible(); // Demo cannot publish real data.
    await page.getByRole("link", { name: "Preview my Skill Passport" }).click();
    await expect(
      page.getByText("PRIVATE PREVIEW · ONLY YOU CAN SEE THIS PAGE"),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Profile setup" }),
    ).not.toBeVisible();
    await nav.getByRole("link", { name: "Opportunities", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Find opportunities", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("organization home separates challenges, paid projects, credentials and review destinations", async ({
  page,
}) => {
  await page.goto("/portal/company");
  await page.screenshot({
    path: `test-results/organization-home-${test.info().project.name}.png`,
    fullPage: true,
  });
  const actions = page.locator(".dashboard-actions");
  await expect(
    actions.getByRole("link", { name: /Organization & credentials/ }),
  ).toHaveAttribute("href", "/organizations");
  await expect(
    actions.getByRole("link", { name: /Create a challenge/ }),
  ).toHaveAttribute("href", "/portal/company/create");
  await expect(
    actions.getByRole("link", { name: /Post a paid project/ }),
  ).toHaveAttribute("href", "/paid-projects/new");
  await expect(actions).toContainText(/unpaid/i);
  await expect(actions).toContainText("test tokens, not real money");
  await page
    .getByRole("navigation", { name: "Account navigation" })
    .getByRole("link", { name: "Wallet", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-in/); // No simulated authenticated wallet workspace.
});
