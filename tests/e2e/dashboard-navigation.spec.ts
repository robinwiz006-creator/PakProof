import { test, expect } from "@playwright/test";

test("sidebar responds while destination data is delayed", async ({ page }) => {
  await page.goto("/portal/talent/passport");
  const nav = page.getByRole("navigation", { name: "Portal navigation" });
  await expect(nav).toBeVisible();
  await page.route("**/portal/talent/achievements*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  const link = nav.getByRole("link", { name: "My Achievements", exact: true });
  await link.click();
  await expect(nav).toBeVisible();
  await expect
    .poll(
      async () => {
        return (
          (await link.getAttribute("aria-current")) === "page" ||
          (await link.locator('[data-pending="true"]').count()) > 0
        );
      },
      { timeout: 800 },
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", { name: "My achievements." }),
  ).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(link.locator('[data-pending="true"]')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
