import { test, expect } from "@playwright/test";
for (const wallet of ["Phantom", "Solflare"] as const) {
  test(`${wallet} selection stays wallet-specific and refuses an incompatible QR`, async ({
    page,
  }) => {
    let ownershipRequests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/wallets")) ownershipRequests++;
    });
    await page.goto("/test-ui");
    await page
      .getByRole("combobox", { name: "Wallet", exact: true })
      .selectOption(wallet);
    await page
      .getByRole("button", { name: "Connect and prove ownership" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: `Connect ${wallet}`, exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: `Connect ${wallet} extension` }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", {
        name: `Connect ${wallet === "Phantom" ? "Solflare" : "Phantom"} extension`,
      }),
    ).not.toBeVisible();
    await dialog
      .getByRole("button", { name: "Connect Phone Wallet", exact: true })
      .click();
    await expect(dialog).toContainText(`${wallet} does not support`);
    await expect(page.locator("w3m-modal")).toHaveCount(0);
    await expect(page.locator("wui-qr-code")).toHaveCount(0);
    await expect(
      page.getByText("Ownership verified and wallet linked", { exact: false }),
    ).not.toBeVisible();
    expect(ownershipRequests).toBe(0);
    await page.screenshot({
      path: `test-results/${wallet.toLowerCase()}-phone-availability-${test.info().project.name}.png`,
    });
    await dialog
      .getByRole("button", { name: `Back to ${wallet} methods` })
      .click();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
  });
}
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
