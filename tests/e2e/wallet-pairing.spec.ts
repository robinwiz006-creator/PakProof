import { test, expect, type Page } from "@playwright/test";
// Isolated Wallet Standard provider fixtures; never real-device approval or settlement.
async function providers(
  page: Page,
  names: string[],
  failure: "connection" | "signature" | "locked" | null = null,
  delayed = false,
) {
  await page.addInitScript(
    ({ names, failure, delayed }) => {
      const account = {
        address: "11111111111111111111111111111111",
        publicKey: new Uint8Array(32),
        chains: ["solana:devnet"],
        features: ["solana:signMessage"],
      };
      const wallets = names.map((name) => ({
        version: "1.0.0",
        name,
        icon: "data:image/svg+xml;base64,PHN2Zy8+",
        chains: ["solana:devnet"],
        accounts: [account],
        features: {
          "standard:connect": {
            version: "1.0.0",
            connect: async () => {
              Object.assign(window, { __proofpakFixtureSelectedWallet: name });
              if (failure === "connection")
                throw new Error("User rejected request");
              if (failure === "locked")
                throw new Error(
                  "Wallet is locked. Unlock your wallet and retry.",
                );
              return { accounts: [account] };
            },
          },
          "standard:disconnect": {
            version: "1.0.0",
            disconnect: async () => {},
          },
          "solana:signMessage": {
            version: "1.0.0",
            signMessage: async () => {
              if (failure === "signature")
                throw new Error("User rejected signature");
              return [
                {
                  signature: new Uint8Array(64),
                  signedMessage: new Uint8Array(),
                },
              ];
            },
          },
        },
      }));
      window.addEventListener("wallet-standard:app-ready", (event) => {
        const register = () =>
          (event as CustomEvent).detail.register(...wallets);
        if (delayed)
          Object.assign(window, { __proofpakRegisterWalletFixture: register });
        else register();
      });
    },
    { names, failure, delayed },
  );
}
for (const wallet of ["Phantom", "Solflare"] as const) {
  test(`${wallet} missing: specific install, retry, no marketplace or phone QR`, async ({
    page,
  }) => {
    let requests = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/wallets")) requests++;
    });
    await page.goto("/test-ui");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(`^${wallet}`) }).click();
    const modal = page.getByRole("dialog", { name: `Connect ${wallet}` });
    // Native dialog heading is also asserted below; modal has explicit accessible label.
    await expect(modal).toContainText(`${wallet} was not detected`);
    await expect(
      modal.getByRole("link", { name: `Install ${wallet}` }),
    ).toHaveAttribute(
      "href",
      wallet === "Phantom"
        ? "https://phantom.com/download"
        : "https://www.solflare.com/download/",
    );
    await modal.getByRole("button", { name: `Retry ${wallet}` }).click();
    await expect(modal).toContainText(`${wallet} was not detected`);
    await expect(
      page.getByRole("button", { name: /Connect Phone|QR/i }),
    ).toHaveCount(0);
    await expect(page.locator("w3m-modal, wui-qr-code")).toHaveCount(0);
    expect(requests).toBe(0);
    await page.screenshot({
      path: `test-results/${wallet}-missing-${test.info().project.name}.png`,
    });
  });
  test(`${wallet} selected among both providers: server refusal never marks linked`, async ({
    page,
  }) => {
    await providers(page, ["Phantom", "Solflare"]);
    await page.route("**/api/wallets", (route) =>
      route.fulfill({
        status:
          route.request().postDataJSON().action === "challenge" ? 200 : 400,
        json:
          route.request().postDataJSON().action === "challenge"
            ? { id: "fixture", message: "Offline fixture message" }
            : { error: "Ownership verification failed or expired." },
      }),
    );
    await page.goto("/test-ui");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();
    await page.getByRole("button", { name: new RegExp(`^${wallet}`) }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText("Ownership verification failed");
    expect(
      await page.evaluate(() =>
        Reflect.get(window, "__proofpakFixtureSelectedWallet"),
      ),
    ).toBe(wallet);
    await expect(modal.getByRole("link", { name: /Install/ })).toHaveCount(0);
    await expect(
      modal.getByText("Wallet linked.", { exact: false }),
    ).toHaveCount(0);
    await modal.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByText("Browser connection", { exact: true }).click();
    await page
      .getByRole("button", { name: "Disconnect browser session" })
      .click();
    await expect(
      page.getByText(
        "Browser session disconnected. Your ProofPak wallet link is unchanged.",
      ),
    ).toBeVisible();
  });
}
for (const failure of ["connection", "signature", "locked"] as const) {
  test(`${failure} failure preserves retry and never claims ownership`, async ({
    page,
  }) => {
    await providers(page, ["Phantom"], failure);
    let verifies = 0;
    await page.route("**/api/wallets", (route) => {
      if (route.request().postDataJSON().action === "verify") verifies++;
      return route.fulfill({
        json: { id: "fixture", message: "Offline fixture" },
      });
    });
    await page.goto("/test-ui");
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();
    await page.getByRole("button", { name: /^Phantom/ }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toContainText(
      failure === "locked" ? "Unlock your wallet" : "Request declined",
    );
    await expect(
      modal.getByRole("button", { name: "Retry Phantom" }),
    ).toBeEnabled();
    expect(verifies).toBe(0);
  });
}
test("personal default ignores old organization intent; explicit organization roles stay separate", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "proofpak:wallet-intent",
      JSON.stringify({
        purpose: "credential_issuer",
        organization: "unrelated",
      }),
    ),
  );
  await page.goto("/test-ui");
  await expect(
    page.getByRole("radio", { name: "Personal", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "Organization", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Connect Wallet", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Organization", exact: true })
    .selectOption("40000000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("button", { name: "Connect Wallet", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Wallet role" })
    .selectOption("credential_issuer");
  await expect(
    page.getByRole("button", { name: "Connect Wallet", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Credential signing requires an approved organization", {
      exact: false,
    }),
  ).toBeVisible();
});
test("linked records distinguish verified from unlinked and retain payment locks", async ({
  page,
}) => {
  await page.goto("/test-ui");
  const links = page.getByRole("region", {
    name: "Linked wallet display fixtures",
  });
  await expect(links).toContainText("Ownership verified");
  await expect(links).toContainText("Unlinked");
  await expect(links).toContainText("11111111111111111111111111111111");
  await links.getByText("Wallet details and unlink").click();
  await expect(links).toContainText("an unresolved payment prevents unlinking");
  await expect(
    links.getByRole("button", { name: "Unlink wallet" }),
  ).toHaveCount(0);
});

test("retry detects a newly available selected provider without losing organization context", async ({
  page,
}) => {
  await providers(page, ["Solflare"], "signature", true);
  let requestedPurpose = "";
  await page.route("**/api/wallets", (route) => {
    requestedPurpose = route.request().postDataJSON().purpose;
    return route.fulfill({
      json: { id: "fixture", message: "Offline test only" },
    });
  });
  await page.goto("/test-ui");
  await page.getByRole("radio", { name: "Organization", exact: true }).check();
  await page
    .getByRole("combobox", { name: "Organization", exact: true })
    .selectOption("40000000-0000-4000-8000-000000000001");
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .click();
  await page.getByRole("button", { name: /^Solflare/ }).click();
  const modal = page.getByRole("dialog");
  await expect(modal).toContainText("Solflare was not detected");
  await page.evaluate(() =>
    Reflect.get(window, "__proofpakRegisterWalletFixture")(),
  );
  await expect(
    modal.getByRole("link", { name: "Install Solflare" }),
  ).toHaveCount(0);
  await modal.getByRole("button", { name: "Retry Solflare" }).click();
  await expect(modal).toContainText("Request declined");
  expect(requestedPurpose).toBe("company_payer");
});
