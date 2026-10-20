import { test, expect } from "@playwright/test";
import { generateKeyPairSync } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import {
  ownershipMessage,
  verifyOwnership,
} from "../../src/lib/wallet-ownership";

test("confirmation validates first, can cancel, and records only after confirmation", async ({
  page,
}) => {
  await page.goto("/test-ui");
  await page.getByRole("button", { name: "Review fixture decision" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByLabel("Private fixture note")
    .fill("A sufficiently detailed isolated fixture decision.");
  await page.getByRole("button", { name: "Review fixture decision" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Recorded fixture decisions: 0")).toBeVisible();
  await page.getByRole("button", { name: "Review fixture decision" }).click();
  await page
    .getByRole("button", { name: "Confirm decision", exact: true })
    .click();
  await expect(page.getByText("Recorded fixture decisions: 1")).toBeVisible();
});

for (const [walletName, purpose] of [
  ["Phantom", "account"],
  ["Solflare", "account"],
  ["Phantom", "company_payer"],
] as const) {
  test(`${walletName} ${purpose}: offline Ed25519 ownership fixture`, async ({
    page,
  }) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const jwk = privateKey.export({ format: "jwk" });
    const bytes = Buffer.from(
      publicKey.export({ format: "jwk" }).x!,
      "base64url",
    );
    const address = getBase58Decoder().decode(bytes);
    await page.addInitScript(
      ({ jwk, address, publicBytes, walletName }) => {
        const imported = crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "Ed25519" },
          false,
          ["sign"],
        );
        const account = {
          address,
          publicKey: new Uint8Array(publicBytes),
          chains: ["solana:devnet"],
          features: ["solana:signMessage"],
        };
        const wallet = {
          version: "1.0.0",
          name: walletName,
          icon: "data:image/svg+xml;base64,PHN2Zy8+",
          chains: ["solana:devnet"],
          accounts: [account],
          features: {
            "standard:connect": {
              version: "1.0.0",
              connect: async () => ({ accounts: [account] }),
            },
            "solana:signMessage": {
              version: "1.0.0",
              signMessage: async (...inputs: { message: Uint8Array }[]) =>
                Promise.all(
                  inputs.map(async ({ message }) => ({
                    signedMessage: message,
                    signature: new Uint8Array(
                      await crypto.subtle.sign(
                        "Ed25519",
                        await imported,
                        new Uint8Array(message),
                      ),
                    ),
                  })),
                ),
            },
          },
        };
        window.addEventListener("wallet-standard:app-ready", (event) => {
          (event as CustomEvent).detail.register(wallet);
        });
      },
      { jwk, address, publicBytes: Array.from(bytes), walletName },
    );
    let signed = false;
    const message = ownershipMessage({
      domain: "http://127.0.0.1:3100",
      userId: "offline-test-user",
      wallet: address,
      purpose,
      organizationId:
        purpose === "account" ? null : "40000000-0000-4000-8000-000000000001",
      nonce: "offline-test-nonce",
      issuedAt: "2026-10-13T00:00:00Z",
      expiresAt: "2026-10-13T00:05:00Z",
    });
    await page.route("**/api/wallets", async (route) => {
      const body = route.request().postDataJSON();
      if (body.action === "challenge") {
        expect(body.wallet).toBe(address);
        expect(body.purpose).toBe(purpose);
        expect(body.organization_id).toBe(
          purpose === "account" ? null : "40000000-0000-4000-8000-000000000001",
        );
        await route.fulfill({ json: { id: "fixture-only", message } });
      } else {
        signed = verifyOwnership(address, message, body.signature);
        await route.fulfill({
          status: signed ? 200 : 400,
          json: signed
            ? { linked: true }
            : { error: "Invalid fixture signature" },
        });
      }
    });
    await page.goto("/test-ui");
    if (purpose === "company_payer") {
      await page
        .getByRole("radio", { name: "Organization", exact: true })
        .check();
      await page
        .getByRole("combobox", { name: "Organization", exact: true })
        .selectOption("40000000-0000-4000-8000-000000000001");
    }
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .click();
    await page.getByRole("button", { name: walletName, exact: false }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Wallet linked. Ownership verified by ProofPak."),
    ).toBeVisible();
    expect(signed).toBe(true);
  });
}

for (const width of [320, 390, 768, 1280]) {
  test(`workspace controls and filtered projects fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/test-ui");
    await page
      .getByRole("radio", { name: "Organization", exact: true })
      .check();
    await expect(
      page.getByRole("combobox", { name: "Wallet role" }),
    ).toHaveValue("company_payer");
    await expect(
      page.getByText("Owner permission required.", { exact: false }),
    ).toBeVisible();
    await page
      .getByLabel("Search paid projects by title, organization, or skill")
      .fill("missing skill");
    await expect(
      page.getByRole("heading", { name: "No matching paid projects" }),
    ).toBeVisible();
    await page
      .getByLabel("Search paid projects by title, organization, or skill")
      .fill("TypeScript");
    await expect(
      page.getByRole("heading", { name: "UI fixture: frontend project" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/workspace-fixtures-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.goto("/portal/talent/passport");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/individual-dashboard-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.goto("/portal/company");
    await page.screenshot({
      path: `test-results/company-dashboard-${width}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
}
