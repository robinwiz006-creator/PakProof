import { test, expect } from "@playwright/test";
test("discovery preferences are separate explicit choices; public sharing alone grants neither", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=employer-discovery");
  const listing = page.getByLabel(
    "Include my published Passport in the employer directory",
  );
  const contact = page.getByLabel(
    "Allow organization contact requests in ProofPak",
  );
  await expect(listing).not.toBeChecked();
  await expect(contact).not.toBeChecked();
  await listing.check();
  await contact.check();
  await page
    .getByRole("button", { name: "Save discovery preferences" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Offline form only:" }),
  ).toContainText('"discoverable":"on"');
  await page.getByLabel("Illustrate a private Passport").check();
  await expect(page.getByText("Private", { exact: true })).toBeVisible();
});
test("candidate evidence labels and private forms retain organization context on mobile", async ({
  page,
}) => {
  await page.goto("/test-ui?fixture=employer-discovery");
  await expect(
    page.getByRole("heading", { name: "Illustrative candidate" }),
  ).toBeVisible();
  await expect(page.getByText("Skills added by the individual")).toBeVisible();
  await expect(page.getByText("Expired", { exact: false })).toBeVisible();
  await page.getByText("Private shortlist note", { exact: true }).click();
  await page
    .getByLabel("Internal note (organization members only)")
    .fill("A short internal note");
  await page.getByRole("button", { name: "Update note" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Offline form only:" }),
  ).toContainText('"company_id":"81000000-0000-4000-8000-000000000003"');
  await page.getByText("Request contact", { exact: true }).click();
  await page
    .getByLabel("Purpose or opportunity", { exact: true })
    .fill("We would like to discuss this public interface project.");
  await page
    .getByLabel("Link to your open opportunity (optional)")
    .selectOption("challenge:81000000-0000-4000-8000-000000000004");
  await page.getByRole("button", { name: "Send contact request" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Offline form only:" }),
  ).toContainText("challenge:81000000-0000-4000-8000-000000000004");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("real contact workspace requires authentication rather than exposing requests", async ({
  page,
}) => {
  await page.goto("/contact-requests?view=outgoing");
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator("input[name=request_id]")).toHaveCount(0);
});
