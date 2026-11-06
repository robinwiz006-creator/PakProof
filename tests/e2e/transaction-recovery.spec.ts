import { test, expect } from "@playwright/test";
const attempt = "a0000000-0000-4000-8000-000000000006",
  intent = "a0000000-0000-4000-8000-000000000007";
for (const stage of ["unsigned", "awaiting_signature", "signed"]) {
  test(`cancellation clears only confirmed unsigned browser state: ${stage}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ stage, attempt, intent }) => {
        if (sessionStorage.getItem("recovery-seeded")) return;
        sessionStorage.setItem("recovery-seeded", "1");
        localStorage.setItem(
          `proofpak:payment-context:${attempt}`,
          JSON.stringify({
            schema: 1,
            attemptId: attempt,
            intentId: intent,
            milestoneId: "fixture-milestone",
            recipient: "fixture-recipient",
            mint: "fixture-mint",
            amount: "1250000",
            stage,
          }),
        );
        localStorage.setItem(
          "proofpak:milestone-signed:fixture-milestone",
          attempt,
        );
        if (stage === "signed")
          localStorage.setItem(
            `proofpak:payment:${attempt}`,
            JSON.stringify({
              signature: "offline-signature-fixture",
              signed_base64: "offline-signed-fixture",
            }),
          );
      },
      { stage, attempt, intent },
    );
    const actions: string[] = [];
    await page.route("**/api/payments", async (route) => {
      actions.push(route.request().postDataJSON().action);
      await route.fulfill({
        json: {
          cancelled: true,
          intent_id: intent,
          unsigned_attempts: [
            {
              id: attempt,
              intent_id: intent,
              status: "cancelled",
              signature: null,
            },
          ],
        },
      });
    });
    await page.goto("/test-ui?fixture=transaction-recovery");
    await page
      .getByRole("button", { name: "Cancel unsigned preparation" })
      .click();
    if (stage === "unsigned") {
      await expect
        .poll(() =>
          page.evaluate(() =>
            localStorage.getItem("proofpak:milestone-signed:fixture-milestone"),
          ),
        )
        .toBe(null);
    } else {
      await expect(
        page.getByText("Server preparation cancelled, but this browser", {
          exact: false,
        }),
      ).toBeVisible();
      expect(
        await page.evaluate(() =>
          localStorage.getItem("proofpak:milestone-signed:fixture-milestone"),
        ),
      ).toBe(attempt);
    }
    expect(actions).toEqual(["cancel"]);
  });
}
for (const kind of ["achievement", "credential"]) {
  test(`${kind} saved proof survives failure/refresh and retries original signature without broadcast`, async ({
    page,
  }) => {
    const id =
      kind === "achievement"
        ? "a0000000-0000-4000-8000-000000000009"
        : "a0000000-0000-4000-8000-000000000010";
    const key = `proofpak:${kind === "achievement" ? "pending" : "credential-pending"}:${id}`;
    const version = kind === "achievement" ? 2 : 3;
    await page.addInitScript(
      ({ key, version }) => {
        if (sessionStorage.getItem("proof-seeded")) return;
        sessionStorage.setItem("proof-seeded", "1");
        localStorage.setItem(
          key,
          JSON.stringify({
            signature: "offline-signature-not-a-real-proof",
            wallet: "offline-wallet-fixture",
            claimVersion: version,
          }),
        );
      },
      { key, version },
    );
    const bodies: unknown[] = [];
    let calls = 0;
    await page.route(
      `**/api/${kind === "achievement" ? "proofs" : "credential-proofs"}`,
      async (route) => {
        bodies.push(route.request().postDataJSON());
        calls++;
        await route.fulfill(
          calls === 1
            ? {
                status: 503,
                json: {
                  error:
                    "Offline RPC or saving timeout; preserve original signature.",
                },
              }
            : { json: { saved: true } },
        );
      },
    );
    await page.goto("/test-ui?fixture=transaction-recovery");
    const section = page.getByRole("region", {
      name:
        kind === "achievement"
          ? "Achievement proof recovery"
          : "Credential proof recovery",
    });
    await expect(
      section.getByRole("button", { name: "Connect wallet & anchor" }),
    ).toBeDisabled();
    await section
      .getByRole("button", { name: "Retry saving existing transaction" })
      .click();
    await expect(
      section.getByText("Offline RPC or saving timeout", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate((key) => localStorage.getItem(key), key),
    ).not.toBeNull();
    await page.reload();
    await expect(
      section.getByRole("button", { name: "Connect wallet & anchor" }),
    ).toBeDisabled();
    await section
      .getByRole("button", { name: "Retry saving existing transaction" })
      .click();
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(null);
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies).toHaveLength(2);
  });
}
test("recovery API cannot bypass cross-origin or unauthenticated authorization", async ({
  request,
}) => {
  const body = { action: "cancel", intent_id: intent };
  const cross = await request.post("/api/payments", {
    headers: { Origin: "https://attacker.example" },
    data: body,
  });
  expect(cross.status()).toBe(403);
  const anonymous = await request.post("/api/payments", {
    headers: { Origin: "http://127.0.0.1:3100" },
    data: body,
  });
  expect(anonymous.status()).toBeGreaterThanOrEqual(400);
  expect(await anonymous.json()).not.toHaveProperty("unsigned_attempts");
  for (const url of [
    `/api/proofs?achievement=a0000000-0000-4000-8000-000000000009`,
    `/api/credential-proofs?credential=a0000000-0000-4000-8000-000000000010`,
  ])
    expect((await request.get(url)).status()).toBeGreaterThanOrEqual(400);
});
for (const stage of ["unsigned", "awaiting_signature"]) {
  test(`refresh after lost cancellation receipt preserves safety: ${stage}`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ stage, attempt, intent }) => {
        if (sessionStorage.getItem("cancel-refresh-seeded")) return;
        sessionStorage.setItem("cancel-refresh-seeded", "1");
        localStorage.setItem(
          `proofpak:payment-context:${attempt}`,
          JSON.stringify({
            schema: 1,
            attemptId: attempt,
            intentId: intent,
            milestoneId: "fixture-milestone",
            recipient: "fixture-recipient",
            mint: "fixture-mint",
            amount: "1250000",
            stage,
          }),
        );
        localStorage.setItem(
          "proofpak:milestone-signed:fixture-milestone",
          attempt,
        );
      },
      { stage, attempt, intent },
    );
    await page.goto("/test-ui?fixture=transaction-recovery-cancelled");
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("proofpak:milestone-signed:fixture-milestone"),
        ),
      )
      .toBe(stage === "unsigned" ? null : attempt);
    await page.reload();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("proofpak:milestone-signed:fixture-milestone"),
      ),
    ).toBe(stage === "unsigned" ? null : attempt);
  });
}
