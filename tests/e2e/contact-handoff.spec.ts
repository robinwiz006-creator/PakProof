import { test, expect } from "@playwright/test";
const fixture = "/test-ui?fixture=contact-handoff";
test("accepted contact has a bounded private next step, without automatic contact details", async ({
  page,
}) => {
  await page.goto(fixture);
  await expect(
    page.getByRole("heading", { name: "Illustrative organization" }),
  ).toBeVisible();
  await expect(
    page.getByText("No email or phone number is shared automatically.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Private follow-up", { exact: true })
    .fill("Could we discuss the requirements and next step?");
  await page.getByRole("button", { name: "Send follow-up" }).click();
  await expect(
    page.getByText("Could we discuss the requirements and next step?", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("5 notes remaining for your side."),
  ).toBeVisible();
});
test("linked opportunity states guide existing applications without promising devnet earnings", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByLabel("Fixture opportunity").selectOption("Open");
  await expect(
    page.getByRole("link", { name: "View opportunity and apply" }),
  ).toHaveAttribute("href", "/paid-projects/fixture");
  await expect(
    page.getByText("Payments use devnet test tokens", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Fixture opportunity").selectOption("Closed");
  await expect(
    page.getByRole("link", { name: "View opportunity and apply" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("This opportunity is no longer open or publicly available."),
  ).toBeVisible();
});
test("candidate can explicitly close contact; ended requests cannot send notes", async ({
  page,
}) => {
  await page.goto(fixture);
  await page.getByText("Stop contact", { exact: true }).click();
  await page.getByLabel("I want to end this contact request.").check();
  await page
    .getByRole("button", { name: "Close contact", exact: true })
    .click();
  await expect(
    page.getByText("Closed by candidate", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send follow-up" }),
  ).toHaveCount(0);
  for (const s of ["declined", "withdrawn", "pending"]) {
    await page.getByLabel("Fixture status").selectOption(s);
    await expect(
      page.getByRole("button", { name: "Send follow-up" }),
    ).toHaveCount(0);
  }
});
test("handoff remains usable at 320px and organization withdrawal is distinct", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(fixture);
  await page.getByLabel("Candidate view", { exact: true }).uncheck();
  await expect(
    page.getByText("Withdraw this request", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
