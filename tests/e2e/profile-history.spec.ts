import { test, expect } from "@playwright/test";
test("history form supports both types and ongoing dates without wallet", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=history");
  await expect(
    page.getByRole("heading", { name: "History form fixture" }),
  ).toBeVisible();
  await page.getByLabel("Record type").selectOption("employment");
  await page.getByLabel("Institution or employer").fill("Example employer");
  await page.getByLabel("Qualification or job title").fill("Engineer");
  await page.getByLabel("Start date").fill("2024-01-01");
  await expect(
    page.getByLabel("Show on my published Passport"),
  ).not.toBeChecked();
  await page.getByLabel("Ongoing education or current position").check();
  await expect(page.getByLabel("End date")).toBeDisabled();
  await page.getByLabel("Ongoing education or current position").uncheck();
  await expect(page.getByLabel("End date")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save record" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
