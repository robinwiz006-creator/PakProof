import { test, expect } from "@playwright/test";
test("workspace and portal sidebars keep matching item geometry for both roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [route, label] of [
    ["/portal/talent", "My Profile"],
    ["/portal/company", "Organization & credentials"],
  ]) {
    await page.goto(route);
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem("proofpak:workspace")),
      )
      .toBe(route.includes("/company") ? "company" : "talent");
    const portal = await page
      .locator(".sidebar nav a")
      .first()
      .evaluate((e) => ({
        height: e.getBoundingClientRect().height,
        width: e.getBoundingClientRect().width,
        padding: getComputedStyle(e).padding,
        align: getComputedStyle(e).textAlign,
      }));
    await page.goto("/test-ui?fixture=navigation");
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
    const workspace = await nav
      .locator("a")
      .first()
      .evaluate((e) => ({
        height: e.getBoundingClientRect().height,
        width: e.getBoundingClientRect().width,
        padding: getComputedStyle(e).padding,
        align: getComputedStyle(e).textAlign,
      }));
    expect(workspace).toEqual(portal);
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(
      nav.getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
});
