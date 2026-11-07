import { test, expect } from "@playwright/test";
// Each layout case visits and captures six separate pages.
test.setTimeout(90_000);
for (const width of [320, 390, 1280]) {
  test(`six refined areas remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, route, target] of [
      [
        "project",
        "/test-ui?fixture=opportunities",
        '[aria-label="Project brief fixture"]',
      ],
      ["sidebar", "/portal/company", ".sidebar"],
      ["credential", "/test-ui?fixture=credential", ".credential-detail"],
      ["profile", "/portal/talent/passport", ".portal-content"],
      ["wallet", "/test-ui?fixture=wallet", ".wallet-page"],
      ["credentials", "/test-ui?fixture=inbox", ".container.page"],
    ]) {
      await page.goto(route);
      await expect(page.locator(target).first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        name,
      ).toBe(true);
      await page.evaluate(() =>
        (document.activeElement as HTMLElement)?.blur(),
      );
      await page
        .locator(target)
        .first()
        .screenshot({
          path: `test-results/refinement-${name}-${width}-${info.project.name}.png`,
        });
    }
  });
}
test("credential summary stays visible while explanations and metadata are collapsed", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=credential");
  const summary = page.getByRole("region", {
    name: "Credential status summary",
  });
  await expect(summary.getByText("Active", { exact: true })).toBeVisible();
  await expect(
    summary.getByText("Not recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Four separate checks" }),
  ).not.toBeVisible();
  await page.getByText("Verification Details", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Four separate checks" }),
  ).toBeVisible();
  await expect(page.locator(".credential-technical dl")).not.toBeVisible();
  await page.getByLabel("Fixture integrity").selectOption("failed");
  await expect(page.locator(".credential-integrity-alert")).toBeVisible();
  await page.getByLabel("Fixture validity").selectOption("revoked");
  await expect(
    page.getByRole("note", { name: "Credential validity alert" }),
  ).toBeVisible();
});
test("credential decisions stay behind management without automatic consent", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=inbox");
  await expect(
    page.getByRole("link", { name: "View Credential" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your decision")).not.toBeVisible();
  await expect(
    page.getByText("Offline decision captured:", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByText("Decision & publication settings", { exact: true })
    .click();
  await page.getByLabel("Your decision").selectOption("declined");
  await page.getByLabel("Display on my published passport").uncheck();
  await page.getByLabel("Also publish supporting evidence").uncheck();
  await page
    .getByRole("button", { name: "Save my decision and visibility" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "declined · public: false · evidence: false",
  );
});
test("personal and organization sidebar labels and icons share left alignment", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of ["/portal/talent", "/portal/company"]) {
    await page.goto(route);
    const values = await page.locator(".sidebar nav a").evaluateAll((links) =>
      links.map((link) => ({
        align: getComputedStyle(link).textAlign,
        justify: getComputedStyle(link).justifyContent,
        x: Math.round(link.getBoundingClientRect().left),
        width: Math.round(link.getBoundingClientRect().width),
        icon: !!link.querySelector("svg"),
      })),
    );
    expect(values.length).toBeGreaterThan(4);
    for (const item of values) {
      expect(item.align).toBe("left");
      expect(item.justify).toBe("flex-start");
      expect(item.icon).toBe(true);
      expect(item.x).toBe(values[0].x);
      expect(item.width).toBe(values[0].width);
    }
    const switchLink = page.locator(".dashboard-switch a");
    await expect(switchLink).toBeVisible();
    expect(
      await switchLink.evaluate((e) => getComputedStyle(e).textAlign),
    ).toBe("left");
  }
});
