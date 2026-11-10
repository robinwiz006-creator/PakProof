import { test, expect } from "@playwright/test";
test("issuer reviews only approved category before creating a link", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=invitation");
  await expect(
    page.getByLabel("Approved category").locator("option"),
  ).toHaveCount(1);
  await page.getByLabel("Recipient email").fill("recipient@example.test");
  await page.getByLabel("Credential title").fill("Synthetic course completion");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Completed a practical synthetic training assessment.");
  await page.getByLabel("Issue date").fill("2026-11-10");
  await page.getByRole("button", { name: "Review invitation" }).click();
  await expect(
    page.getByRole("button", { name: "Create invitation link" }),
  ).toBeVisible();
  await expect(page.getByText(/no email is sent/i)).toBeVisible();
  await page.getByLabel("Credential title").fill("Updated title");
  await expect(
    page.getByRole("button", { name: "Review invitation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("private invitation keeps context across registration and login without leaking credential details", async ({
  page,
}) => {
  const path = "/credential-invitations/" + "b".repeat(64);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "A credential invitation" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  await expect(page.locator('input[name="next"]')).toHaveValue(path);
  const login = page.getByRole("link", { name: "Sign in", exact: true });
  await login.click();
  expect(new URL(page.url()).searchParams.get("next")).toBe(path);
  await page.reload();
  await expect(page.locator('input[name="next"]')).toHaveValue(path);
});
