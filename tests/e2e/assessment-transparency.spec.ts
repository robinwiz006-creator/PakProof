import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=challenge-assessment";
test("reviewer records a real method and score explicitly, separate from private feedback", async ({
  page,
}) => {
  await page.goto(fixture);
  await expect(
    page.getByLabel("Primary assessment method", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Record what was assessed and how").check();
  await page
    .getByLabel("Skills or competencies assessed")
    .fill("React, Keyboard accessibility");
  await page
    .getByLabel("Primary assessment method", { exact: true })
    .selectOption("code_review");
  await page
    .getByLabel("Publication-ready assessment result")
    .fill("Reviewed accessible controls and explained the implementation.");
  await page
    .getByLabel("Score (optional, whole number)", { exact: true })
    .fill("4");
  await page.getByLabel("Maximum score (if scored)", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Capture assessment fields" }).click();
  await expect(
    page.getByText("Offline metadata: code_review · 4", { exact: true }),
  ).toBeVisible();
});
test("recipient controls method and score visibility; old assessments do not invent missing metadata", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel("Use illustrative detailed assessment").check();
  await expect(
    page.getByText("4 / 5 (reported by evaluator)", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Share illustrative assessment results").check();
  await expect(page.getByText("Code review", { exact: true })).toBeVisible();
  await expect(
    page.getByText("4 / 5 (reported by evaluator)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative assessment organization", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The individual reviewer’s identity is recorded privately.",
      { exact: false },
    ),
  ).toBeVisible();
  await page.getByLabel("Use illustrative detailed assessment").uncheck();
  await expect(
    page.getByText("were not recorded with this historical assessment.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("4 / 5 (reported by evaluator)", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Share illustrative assessment results").uncheck();
  await expect(
    page.getByText("Assessment results are private.", { exact: false }),
  ).toBeVisible();
});
test("assessment transparency fits 320px without revealing private reviewer notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixture);
  await page.getByLabel("Use illustrative detailed assessment").check();
  await page.getByLabel("Share illustrative assessment results").check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByText("ProofPak has not independently rescored the work.", {
      exact: false,
    }),
  ).toBeVisible();
});
