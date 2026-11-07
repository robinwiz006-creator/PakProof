import test from "node:test";
import assert from "node:assert/strict";
import {
  followupInput,
  canFollowup,
  contactStatus,
} from "../src/lib/contact-handoff";
test("bounded follow-up validates topic, body and untrusted input", () => {
  assert.ok(
    followupInput.safeParse({
      topic: "question",
      body: "A clear next-step question.",
    }).success,
  );
  for (const v of [
    { topic: "chat", body: "A clear next-step question." },
    { topic: "response", body: "short" },
    { topic: "next_steps", body: "x".repeat(1001) },
  ])
    assert.equal(followupInput.safeParse(v).success, false);
});
test("only accepted contact with current consent and remaining quota can continue", () => {
  assert.equal(canFollowup("accepted", true, 5), true);
  for (const status of ["pending", "declined", "withdrawn", "closed"])
    assert.equal(canFollowup(status, true, 0), false);
  assert.equal(canFollowup("accepted", false, 0), false);
  assert.equal(canFollowup("accepted", true, 6), false);
});
test("ended contact statuses have explicit user-facing labels", () => {
  assert.equal(contactStatus("closed"), "Closed by candidate");
  assert.equal(contactStatus("withdrawn"), "Withdrawn by organization");
  assert.match(contactStatus("pending"), /decision/);
});
