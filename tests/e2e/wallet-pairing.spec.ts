import { test, expect } from "@playwright/test";
test("wallet modal offers actual methods, cancellation, and honest missing configuration", async ({
  page,
}) => {
  await page.goto("/test-ui");
  await page
    .getByRole("button", { name: "Connect and prove ownership" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Connect Phantom extension" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Connect Solflare extension" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/wallet-method-modal-${test.info().project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Connect and prove ownership" })
    .click();
  await dialog
    .getByRole("button", { name: "Connect phone wallet / QR" })
    .click();
  await expect(
    page.getByText("Mobile QR pairing needs a Reown project ID.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("Ownership verified and wallet linked", { exact: false }),
  ).not.toBeVisible();
  await page.screenshot({
    path: `test-results/wallet-pairing-configuration-needed-${test.info().project.name}.png`,
  });
});
test("unavailable extension fails honestly and lets the user select another method", async ({
  page,
}) => {
  await page.goto("/test-ui");
  await page
    .getByRole("button", { name: "Connect and prove ownership" })
    .click();
  await page.getByRole("button", { name: "Connect Phantom extension" }).click();
  await expect(
    page.getByText("No Phantom message-signing connection was detected.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect and prove ownership" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("mobile return restores only eligible purpose and organization, never ownership", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "proofpak:wallet-intent",
      JSON.stringify({
        purpose: "company_payer",
        organization: "unrelated-organization",
      }),
    ),
  );
  await page.goto("/test-ui");
  await expect(
    page.getByRole("combobox", { name: "Purpose", exact: true }),
  ).toHaveValue("company_payer");
  await expect(
    page.getByText("Ownership verified and wallet linked", { exact: false }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Connect and prove ownership" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Company payer");
});
