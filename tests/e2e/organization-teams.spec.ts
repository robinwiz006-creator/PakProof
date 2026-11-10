import { test, expect } from "@playwright/test";
test("owner and administrator role choices match authority and require review", async ({
  page,
}) => {
  for (const actor of ["owner", "admin"]) {
    await page.goto(`/test-ui?fixture=team-${actor}`);
    await page
      .getByLabel("Email address", { exact: true })
      .fill("new-team@example.test");
    const roles = page.getByRole("combobox", {
      name: "Team role",
      exact: true,
    });
    expect(await roles.locator('option[value="administrator"]').count()).toBe(
      actor === "owner" ? 1 : 0,
    );
    await roles.selectOption("credential_manager");
    await page.getByRole("button", { name: "Review team invitation" }).click();
    await expect(
      page.getByText("Invite new-team@example.test as Credential manager?"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create private invitation link" }),
    ).toBeVisible();
    await expect(
      page.getByText(/No email is sent automatically/),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("team invitation handoff retains its safe destination through account creation", async ({
  page,
}) => {
  const path = "/team-invitations/" + "a".repeat(64);
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Join an organization on ProofPak" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create an account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sign-up\?/);
  await expect(page.locator('input[name="next"]')).toHaveValue(path);
  await page.reload();
  await expect(page.locator('input[name="next"]')).toHaveValue(path);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.locator('input[name="next"]')).toHaveValue(path);
});
