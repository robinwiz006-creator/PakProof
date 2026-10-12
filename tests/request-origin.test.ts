import test from "node:test";
import assert from "node:assert/strict";
import {
  sameRequestOrigin,
  requestSiteOrigin,
} from "../src/lib/request-origin";
test("origin guard uses HTTP host behind a bind address and refuses cross-origin or absent origins", () => {
  const request = new Request("http://0.0.0.0:3100/api/payments", {
    headers: { Host: "127.0.0.1:3100", Origin: "http://127.0.0.1:3100" },
  });
  assert.ok(sameRequestOrigin(request));
  const production = new Request("http://internal:3000/api/payments", {
    headers: {
      Host: "proofpak.example",
      Origin: "https://proofpak.example",
      "X-Forwarded-Proto": "https",
    },
  });
  assert.ok(sameRequestOrigin(production));
  assert.equal(requestSiteOrigin(production), "https://proofpak.example");
  assert.ok(
    !sameRequestOrigin(
      new Request("https://proofpak.example/api/payments", {
        headers: {
          Host: "proofpak.example",
          Origin: "https://attacker.example",
          "X-Forwarded-Host": "attacker.example",
        },
      }),
    ),
  );
  assert.ok(
    !sameRequestOrigin(new Request("https://proofpak.example/api/payments")),
  );
  assert.ok(
    !sameRequestOrigin(
      new Request("https://proofpak.example/api/payments", {
        headers: { Origin: "null" },
      }),
    ),
  );
});
