import test from "node:test";
import assert from "node:assert/strict";
import { tokenUnits, tokenAmount } from "../src/lib/payments";
test("token arithmetic uses exact base units, never floating point", () => {
  assert.equal(tokenUnits("1.000001"), "1000001");
  assert.equal(tokenUnits("0.000001"), "1");
  assert.equal(tokenUnits("1000000"), "1000000000000");
  assert.equal(tokenAmount("1250000"), "1.25");
  for (const invalid of [
    "0",
    "-1",
    "1e3",
    "0.0000001",
    "1.0000009",
    "NaN",
    "1000001",
  ])
    assert.throws(() => tokenUnits(invalid));
});
