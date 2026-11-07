import { test, expect } from "@playwright/test";
test("credential categories follow the selected issuer without granting hidden degree authority", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=issuer-permissions");
  const org = page.getByLabel("Issuing organization");
  const type = page.getByLabel("Credential type");
  await expect(type.locator("option")).toHaveCount(2);
  await expect(type).not.toContainText("degree");
  await org.selectOption("academic-fixture");
  await expect(type.locator("option")).toHaveCount(1);
  await expect(type).toHaveValue("degree");
  await org.selectOption("legacy-fixture");
  await expect(type.locator("option")).toHaveCount(0);
  await org.selectOption("training-fixture");
  await expect(type).toHaveValue("course");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("historical credential does not invent representative attribution or category review", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=credential");
  await expect(
    page.getByText(
      "Historical organization approval; category review not recorded.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Historical issuing representative was not recorded; no attribution has been invented.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("strong", { name: "Category approved at issuance" }),
  ).toHaveCount(0);
});
