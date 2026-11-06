import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=credential";
test("correction recipient sees acceptance consequences without any inherited consent", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel("Correction fixture").selectOption("pending");
  await expect(
    page.getByText("Review before accepting.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View earlier record ↗" }),
  ).toHaveAttribute("href", "/credentials/earlier-fixture");
  await page.getByLabel("Correction fixture").selectOption("declined");
  await expect(
    page.getByText("Replacement declined.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Review before accepting.", { exact: false }),
  ).toHaveCount(0);
});
test("private successor is disclosed only as supersession, never as a public link", async ({
  page,
}) => {
  await page.goto(fixture);
  await page
    .getByLabel("Correction fixture")
    .selectOption("superseded-private");
  await expect(
    page.getByText("Superseded credential", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("The current replacement is not public.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View current replacement ↗" }),
  ).toHaveCount(0);
  await page.getByLabel("Correction fixture").selectOption("superseded-public");
  await expect(
    page.getByRole("link", { name: "View current replacement ↗" }),
  ).toHaveAttribute("href", "/credentials/replacement-fixture");
});
test("revocation remains the primary warning for a superseded credential", async ({
  page,
}) => {
  await page.goto(fixture);
  await page
    .getByLabel("Correction fixture")
    .selectOption("superseded-private");
  await page.getByLabel("Fixture validity").selectOption("revoked");
  await expect(
    page.getByText("Revoked credential", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Superseded by an accepted correction.", { exact: false }),
  ).toBeVisible();
});
