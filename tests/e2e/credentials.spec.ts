import { test, expect } from "@playwright/test";
for (const width of [320, 390]) {
  test(`credential workspaces require real configuration at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "/organizations",
      "/my-credentials",
      "/wallet",
      "/issuer-admin",
    ]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/credentials/10000000-0000-4000-8000-000000000001");
    await expect(
      page.getByRole("heading", { name: "This page isn’t available." }),
    ).toBeVisible();
    await page.goto("/talent/ayesha-khan");
    await expect(page.locator('a[href^="/credentials/"]')).toHaveCount(0);
    await expect(
      page.getByText("Onchain verified", { exact: true }),
    ).toHaveCount(0);
  });
}
test("new proof and wallet APIs reject unauthorized/cross-origin requests", async ({
  request,
}) => {
  const prepared = await request.get(
    "/api/credential-proofs?credential=10000000-0000-4000-8000-000000000001",
  );
  expect(prepared.status()).toBe(403);
  for (const route of ["/api/wallets", "/api/credential-proofs"]) {
    const denied = await request.post(route, {
      headers: { Origin: "https://attacker.example" },
      data: {},
    });
    expect(denied.status()).toBe(403);
    expect(await denied.json()).toEqual({ error: "Invalid request origin." });
  }
});
