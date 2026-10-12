import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1280]) {
  test(`passport-first marketing and honest empty listings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const main = page.locator(".marketing-home");
    for (const heading of [
      "Everything you do. One place to show it.",
      "Find your next opportunity.",
      "Your work speaks for itself.",
      "Proof that goes beyond a claim.",
      "Turn your skills into paid work.",
      "Find people who can actually do the work.",
      "Your next opportunity starts here.",
    ]) {
      await expect(main.getByRole("heading", { name: heading })).toBeVisible();
    }
    const listings = page.getByTestId("live-opportunities");
    await expect(
      listings.getByText("No open challenges right now.", { exact: false }),
    ).toBeVisible();
    await expect(
      listings.getByText("No open paid projects right now.", { exact: false }),
    ).toBeVisible();
    await expect(listings.locator("a")).toHaveCount(0);
    await expect(
      main.getByText(
        "Design example only. No verified record or blockchain proof.",
        { exact: true },
      ),
    ).toHaveCount(2);
    await expect(
      main.getByRole("link", { name: "Get Started as an Organization" }),
    ).toHaveAttribute("href", "/sign-up?role=company");
    await expect(
      main.getByRole("link", { name: "View All Opportunities" }),
    ).toHaveAttribute("href", "/opportunities");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/marketing-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await main
      .getByRole("link", { name: "Build Your Passport", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-up\?role=talent$/);
    await expect(
      page.getByRole("heading", { name: /Create your account/ }),
    ).toBeVisible();
  });
}
