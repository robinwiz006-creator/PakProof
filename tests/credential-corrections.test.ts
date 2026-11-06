import test from "node:test";
import assert from "node:assert/strict";
import {
  credentialValidity,
  correctionStatus,
  type CorrectionStatus,
} from "../src/lib/credentials";
const status: CorrectionStatus = {
  credential_id: "old",
  is_replacement: false,
  replaces_id: null,
  superseded: true,
  pending_replacement_id: null,
  replacement_id: null,
  incoming_state: null,
};
test("supersession is separate from revocation, expiry and proof integrity", () => {
  const c = {
    credential_events: [],
    expiry_date: null,
    credential_correction_status: status,
  };
  assert.equal(credentialValidity(c), "Superseded");
  assert.equal(
    credentialValidity({
      ...c,
      credential_events: [
        {
          event_type: "revoked",
          reason: "withdrawn",
          created_at: "2026-01-01",
        },
      ],
    }),
    "Revoked",
  );
  assert.equal(
    credentialValidity({ ...c, expiry_date: "2020-01-01" }),
    "Superseded",
  );
});
test("pending or declined correction never makes an original superseded", () => {
  for (const incoming_state of ["pending", "declined", "withdrawn"]) {
    const c = {
      credential_events: [],
      expiry_date: null,
      credential_correction_status: {
        ...status,
        superseded: false,
        incoming_state,
        pending_replacement_id: "pending",
      },
    };
    assert.equal(credentialValidity(c), "Current");
  }
});
test("historical records with no correction projection preserve old rules", () => {
  assert.equal(correctionStatus({}), undefined);
  assert.equal(
    credentialValidity({ credential_events: [], expiry_date: null }),
    "Current",
  );
  assert.equal(
    credentialValidity({ credential_events: [], expiry_date: "2020-01-01" }),
    "Expired",
  );
});
test("correction projection handles PostgREST relation cardinalities without synthesizing hidden links", () => {
  assert.equal(
    correctionStatus({ credential_correction_status: status })?.replacement_id,
    null,
  );
  assert.equal(
    correctionStatus({ credential_correction_status: [status] })?.superseded,
    true,
  );
  assert.equal(
    correctionStatus({ credential_correction_status: [] }),
    undefined,
  );
});
