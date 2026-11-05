import { test, expect } from "@playwright/test";
for (const width of [320, 390, 1280]) {
  test(`draft corrections and unknown payment recovery at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-ui?fixture=paid-lifecycle");
    await expect(page.getByLabel("Project title")).toHaveValue(
      "Draft accessibility project",
    );
    await page
      .getByLabel("Project title")
      .fill("Corrected accessible dashboard");
    await expect(
      page.getByLabel("Total budget in devnet test USDC"),
    ).toHaveValue("1.25");
    await expect(
      page.getByRole("button", { name: "Save draft corrections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add milestone", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Remove milestone", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Keep this transaction signature.", { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check and save existing transaction" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel unsigned preparation" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("browser recovery registers only original saved bytes; it never broadcasts a transfer", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/payments", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: { registered: true, signature: "offline-signature-fixture" },
    });
  });
  await page.goto("/test-ui?fixture=paid-lifecycle");
  await page.evaluate(() =>
    localStorage.setItem(
      "proofpak:payment:a0000000-0000-4000-8000-000000000006",
      JSON.stringify({
        signature: "offline-signature-fixture",
        signed_base64: "offline-signed-bytes-not-a-real-transaction",
      }),
    ),
  );
  await page
    .getByRole("button", { name: "Recover saved signed payment" })
    .click();
  await expect(
    page.getByText("Original signature saved on the server.", { exact: false }),
  ).toBeVisible();
  expect(requests).toEqual([
    {
      action: "register",
      attempt_id: "a0000000-0000-4000-8000-000000000006",
      signed_base64: "offline-signed-bytes-not-a-real-transaction",
    },
  ]);
});
test("saved signed milestone prevents a replacement prepare request after refresh", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests: unknown[] = [];
  await page.route("**/api/payments", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });
  await page.goto("/test-ui?fixture=paid-lifecycle");
  await page.evaluate(() =>
    localStorage.setItem(
      "proofpak:milestone-signed:a0000000-0000-4000-8000-000000000003",
      "original-attempt-fixture",
    ),
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Prepare and review payment" })
    .click();
  await expect(
    page.getByText("This browser saved a signed attempt", { exact: false }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});
test("missing saved bytes fail closed without a payment request", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests: unknown[] = [];
  await page.route("**/api/payments", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: {} });
  });
  await page.goto("/test-ui?fixture=paid-lifecycle");
  await page
    .getByRole("button", { name: "Recover saved signed payment" })
    .click();
  await expect(
    page.getByText("Saved signed bytes are unavailable.", { exact: false }),
  ).toBeVisible();
  expect(requests).toEqual([]);
});
