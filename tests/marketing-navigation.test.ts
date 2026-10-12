import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Navigation } from "../src/components/navigation";

test("navigation presentation keeps signed-in passport and organization destinations", () => {
  const signedIn = renderToStaticMarkup(
    createElement(Navigation, { signedIn: true }),
  );
  assert.ok(signedIn.includes('href="/portal/talent/passport"'));
  assert.ok(signedIn.includes('href="/portal/talent"'));
  assert.ok(signedIn.includes('href="/organizations"'));
  assert.ok(!signedIn.includes('href="/sign-up"'));
  const signedOut = renderToStaticMarkup(
    createElement(Navigation, { signedIn: false }),
  );
  assert.ok(signedOut.includes('href="/sign-in"'));
  assert.ok(signedOut.includes('href="/sign-up"'));
  assert.ok(signedOut.includes('href="/#organizations"'));
});
