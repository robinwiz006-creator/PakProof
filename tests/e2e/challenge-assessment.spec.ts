import { test, expect } from "@playwright/test";
test("rubric builder is optional, bounded and removable; outcomes remain explicit", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=challenge-assessment");
  await page
    .getByRole("button", { name: "Add criterion", exact: true })
    .click();
  await page.getByLabel("Criterion 1 title").fill("Keyboard navigation");
  await page
    .getByLabel("What will you evaluate?")
    .fill("All controls support keyboard navigation.");
  const value = await page.locator("input[name=criteria]").inputValue();
  expect(JSON.parse(value)[0].title).toBe("Keyboard navigation");
  for (let i = 1; i < 6; i++)
    await page
      .getByRole("button", { name: "Add criterion", exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Add criterion", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Remove criterion 6", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add criterion", exact: true }),
  ).toBeVisible();
  await expect(page.locator("select[name=outcomes]")).toHaveValue("");
  await page.locator("select[name=outcomes]").selectOption("needs_improvement");
  await expect(page.locator("select[name=outcomes]")).toHaveValue(
    "needs_improvement",
  );
});
test("assessment summary requires evidence choice and contains no private review text", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=challenge-assessment");
  await expect(
    page.getByText("Assessment results are private.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("section").getByRole("listitem")).toHaveCount(0);
  await page.getByLabel("Share illustrative assessment results").check();
  await expect(page.getByRole("listitem")).toContainText("Meets criterion");
  await page.getByLabel("Share illustrative assessment results").uncheck();
  await expect(
    page.getByText("Assessment results are private.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
