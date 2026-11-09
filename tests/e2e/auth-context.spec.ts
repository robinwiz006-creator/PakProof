import { test, expect } from "@playwright/test";
const challenge = "/challenges/00000000-0000-4000-8000-000000000001#submit";
const project = "/paid-projects/90000000-0000-4000-8000-000000000001";
const login = (next: string) => `/sign-in?${new URLSearchParams({ next })}`;

for (const next of [challenge, project]) {
  test(`${next.split("/")[1]} context survives signup/login, refresh and server-action failure`, async ({
    page,
  }) => {
    await page.goto(login(next));
    await expect(page.getByText(/Continue to your selected/)).toContainText(
      next === challenge ? "challenge" : "project",
    );
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await page
      .getByRole("link", { name: "Create an account", exact: true })
      .click();
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await page.reload();
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page.getByLabel("Email address").fill("fixture@example.invalid");
    await page
      .getByLabel("Password", { exact: true })
      .fill("offline-password-only");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    // Actual server action with deliberately absent Supabase: no hosted login performed.
    await expect(page.getByRole("status")).toContainText(
      "Connect Supabase before signing in.",
    );
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    expect(new URL(page.url()).searchParams.get("next")).toBe(next);
    await page.reload();
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await page
      .getByRole("link", { name: "Resend confirmation", exact: true })
      .click();
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
    await page.getByLabel("Email address").fill("fixture@example.invalid");
    await page
      .getByRole("button", { name: "Resend confirmation", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Email confirmation requires Supabase.",
    );
    await page
      .getByRole("link", { name: "Back to sign in", exact: true })
      .click();
    await expect(page.locator('input[name="next"]')).toHaveValue(next);
  });
}

test("paid-project visitor link opens authentication for that exact project", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=opportunities");
  await page.getByLabel("Fixture applicant context").selectOption("visitor");
  await page.getByRole("link", { name: "Sign in to apply" }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue(project);
  await expect(
    page.getByText(/Continue to your selected project/),
  ).toBeVisible();
});

test("signup server-action failure preserves context and the company starting preference", async ({
  page,
}) => {
  await page.goto(
    `/sign-up?${new URLSearchParams({ next: project, role: "company" })}`,
  );
  await page.getByLabel("Your full name").fill("Offline fixture");
  await page.getByLabel("Email address").fill("fixture@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("offline-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Connect Supabase before creating an account.",
  );
  await expect(page.locator('input[name="next"]')).toHaveValue(project);
  await expect(page.getByLabel("I’m here to")).toHaveValue("company");
});

test("unsafe destinations are discarded in forms, switches and callback failures", async ({
  page,
}) => {
  for (const next of [
    "//evil.example",
    "https://evil.example",
    "/auth/callback",
    `${project}?pay=true`,
  ]) {
    await page.goto(login(next));
    await expect(page.locator('input[name="next"]')).toHaveValue("");
    await expect(
      page.getByRole("link", { name: "Create an account", exact: true }),
    ).toHaveAttribute("href", "/sign-up");
    await expect(page.getByText(/Continue to your selected/)).toHaveCount(0);
  }
  await page.goto(
    `/auth/callback?${new URLSearchParams({ next: "https://evil.example", code: "offline-not-exchanged" })}`,
  );
  await expect(page).toHaveURL(/\/sign-in\?message=/);
  expect(new URL(page.url()).searchParams.has("next")).toBe(false);
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3100");
  await expect(page.getByRole("status")).toContainText(
    "Email confirmation failed.",
  );
});

test("missing email code keeps the safe context and supplies a usable retry", async ({
  page,
}) => {
  await page.goto(`/auth/callback?${new URLSearchParams({ next: challenge })}`);
  await expect(page).toHaveURL(/\/sign-in\?/);
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3100");
  await expect(page.getByRole("status")).toContainText(
    "Email confirmation failed.",
  );
  await expect(page.locator('input[name="next"]')).toHaveValue(challenge);
});

test("no destination still permits normal navigation and password recovery", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await expect(page.locator('input[name="next"]')).toHaveValue("");
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reset your password." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await expect(
    page.getByRole("link", { name: "Create an account", exact: true }),
  ).toHaveAttribute("href", "/sign-up");
});

test("unavailable opportunities offer a safe discovery route; closed work cannot apply", async ({
  page,
}) => {
  for (const destination of [project, challenge.split("#")[0]]) {
    await page.goto(destination);
    await expect(
      page.getByRole("heading", { name: "This page isn’t available." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Explore opportunities", exact: true }),
    ).toHaveAttribute("href", "/opportunities");
    await expect(
      page.getByRole("button", { name: "Apply", exact: true }),
    ).toHaveCount(0);
  }
  await page.goto("/test-ui?fixture=opportunities");
  await page.getByLabel("Fixture applicant context").selectOption("closed");
  await expect(
    page.getByText("Applications closed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toHaveCount(0);
});

test("authentication context is usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(login(project));
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await expect(page.locator('input[name="next"]')).toHaveValue(project);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("header Auth links preserve intent on opportunity and Auth pages", async ({
  page,
}) => {
  const reveal = async () => {
    const menu = page.getByRole("button", { name: "Open navigation" });
    if (await menu.isVisible()) await menu.click();
  };
  await page.goto(project); // No hosted data: unavailable body still retains its opportunity URL.
  await reveal();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Get Started", exact: true }),
  ).toHaveAttribute(
    "href",
    `/sign-up?${new URLSearchParams({ next: project })}`,
  );
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Get Started", exact: true })
    .click();
  await reveal();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Log In", exact: true })
    .click();
  await expect(page.locator('input[name="next"]')).toHaveValue(project);
  await reveal();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Get Started", exact: true }),
  ).toHaveAttribute(
    "href",
    `/sign-up?${new URLSearchParams({ next: project })}`,
  );
});
