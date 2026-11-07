import test from "node:test";
import assert from "node:assert/strict";
import {
  paymentStatusLabel,
  milestoneWorkLabel,
  paymentRecoveryGuidance,
} from "../src/lib/payments";
test("payment labels distinguish signatures, final settlement and unknown outcomes", () => {
  assert.match(paymentStatusLabel("prepared"), /wallet signature/);
  assert.match(paymentStatusLabel("registered"), /not yet verified/);
  assert.match(paymentStatusLabel("paid"), /verified/);
  assert.match(paymentStatusLabel("needs_review"), /unknown/);
});
test("unknown signed outcomes never suggest repayment or cancellation", () => {
  for (const status of ["signed", "registered", "pending", "needs_review"]) {
    assert.match(
      paymentRecoveryGuidance(status, "original-signature"),
      /do not prepare or send a replacement/,
    );
  }
  assert.match(
    paymentRecoveryGuidance("cancelled", null),
    /No blockchain transfer was reversed/,
  );
  assert.match(
    paymentRecoveryGuidance("prepared", null),
    /signing was rejected/,
  );
});

test("work approval stays separate from payment verification", () => {
  assert.equal(milestoneWorkLabel("not_submitted"), "Awaiting work");
  assert.equal(milestoneWorkLabel("revisions"), "Revision requested");
  assert.equal(milestoneWorkLabel("approved"), "Work approved");
  assert.equal(paymentStatusLabel("prepared"), "Awaiting wallet signature");
});
