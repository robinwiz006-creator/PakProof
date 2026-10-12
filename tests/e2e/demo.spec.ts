import { test, expect } from "@playwright/test";
test("landing has two clear paths and responsive navigation", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /You have the skills/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Build Your Skill Passport", exact: true }),
  ).toHaveAttribute("href", "/sign-up?role=talent");
  await expect(
    page.getByRole("link", { name: "Find Proven Talent", exact: true }),
  ).toHaveAttribute("href", "/sign-up?role=company");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: `test-results/landing-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("challenge filtering and detail explain demo limits", async ({ page }) => {
  await page.goto("/challenges");
  await expect(page.getByText(/Demonstration data/)).toBeVisible();
  await page
    .getByRole("textbox", {
      name: "Search challenges by title, company, or skill",
    })
    .fill("Python");
  await expect(
    page.getByRole("heading", { name: "Find the story in a customer dataset" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Build a dashboard people can understand",
    }),
  ).toHaveCount(0);
  await page
    .getByRole("heading", { name: "Find the story in a customer dataset" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Expected deliverables" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Real submissions become available/),
  ).toBeVisible();
});
test("all demo portals render without runtime errors or horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/how-it-works",
    "/talent/ayesha-khan",
    "/sign-in",
    "/sign-up",
    "/portal/talent",
    "/portal/talent/profile",
    "/portal/talent/projects",
    "/portal/talent/browse",
    "/portal/talent/submissions",
    "/portal/talent/passport",
    "/portal/company",
    "/portal/company/profile",
    "/portal/company/create",
    "/portal/company/challenges",
    "/portal/company/reviews",
    "/portal/company/directory",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    if (path.startsWith("/portal/") || path.startsWith("/talent/")) {
      await expect(page.getByText(/Demonstration data/)).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      path,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("demo passport never claims a company or blockchain achievement", async ({
  page,
}) => {
  await page.goto("/talent/ayesha-khan");
  await expect(
    page.getByText(/Projects and skills are added by the individual/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Campus expense tracker" }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/verify/"]')).toHaveCount(0);
  await expect(page.getByText("Onchain verified", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/verify/not-a-real-achievement");
  await expect(
    page.getByRole("heading", { name: "This page isn’t available." }),
  ).toBeVisible();
});
test("unconfigured signup returns a clear error rather than a fake account", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await expect(
    page.getByText(/Account creation requires Supabase/),
  ).toBeVisible();
  await page.getByLabel("Your full name").fill("Test Candidate");
  await page.getByLabel("Email address").fill("candidate@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Connect Supabase before creating an account.",
  );
});
test("passport-first onboarding, preview and recovery routes work at small mobile widths", async ({
  page,
}) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/portal/talent");
    await expect(
      page.getByRole("heading", { name: "Your passport progress" }),
    ).toBeVisible();
    await expect(page.locator(".passport-checklist li")).toHaveCount(6);
    await page.goto("/portal/talent/preview");
    await expect(
      page.getByText("PRIVATE PREVIEW · ONLY YOU CAN SEE THIS PAGE"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Campus expense tracker" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/portal/talent/achievements");
    await expect(
      page.getByText(/Company-approved facts cannot be edited/),
    ).toBeVisible();
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill("nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Account recovery requires Supabase",
    );
    await page.goto("/resend-confirmation");
    await expect(
      page.getByRole("button", { name: "Resend confirmation" }),
    ).toBeVisible();
  }
});
test("proof API refuses unauthenticated preparation and cross-origin writes", async ({
  request,
}) => {
  const id = "00000000-0000-4000-8000-000000000001";
  const get = await request.get(`/api/proofs?achievement=${id}`);
  expect(get.status()).toBe(403);
  const post = await request.post("/api/proofs", {
    headers: { origin: "https://untrusted.example" },
    data: {
      achievementId: id,
      signature: "x".repeat(88),
      issuerWallet: "x".repeat(44),
      claimVersion: 2,
    },
  });
  expect(post.status()).toBe(403);
});
