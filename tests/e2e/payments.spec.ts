import { test, expect } from "@playwright/test";
for (const width of [320, 390, 1280]) {
  test(`opportunities and payment guardrails at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 850 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/opportunities");
    await expect(
      page.getByRole("heading", { name: "Find opportunities" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore paid projects ↗" }),
    ).toHaveAttribute("href", "/paid-projects");
    await page.goto("/paid-projects");
    await expect(
      page.getByText(
        "We could not load paid projects. Please try again later. No projects or payments are being simulated.",
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const route of ["/paid-projects/new", "/payments"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
    }
    await page.goto("/paid-projects/10000000-0000-4000-8000-000000000001");
    await expect(
      page.getByRole("heading", { name: "This page isn’t available." }),
    ).toBeVisible();
    await page.goto("/talent/ayesha-khan");
    await expect(
      page.getByRole("heading", { name: "Completed work", exact: true }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
test("payment API rejects cross-origin and unconfigured settlement; job requires a secret", async ({
  request,
}) => {
  const denied = await request.post("/api/payments", {
    headers: { Origin: "https://attacker.example" },
    data: {
      action: "reconcile",
      attempt_id: "10000000-0000-4000-8000-000000000001",
    },
  });
  expect(denied.status()).toBe(403);
  const disabled = await request.post("/api/payments", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: {
      action: "prepare",
      milestone_id: "10000000-0000-4000-8000-000000000001",
      payer_connection_id: "20000000-0000-4000-8000-000000000001",
    },
  });
  expect(disabled.status()).toBe(400);
  expect((await disabled.json()).error).toBe(
    "Supabase payments are not configured.",
  );
  const job = await request.get("/api/payments/reconcile");
  expect(job.status()).toBe(503);
});
