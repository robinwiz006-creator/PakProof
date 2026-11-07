import test from "node:test";
import assert from "node:assert/strict";
import { Connection, PublicKey } from "solana-web3-legacy";

// Entirely intercepted JSON-RPC fixtures. Never connects to Solana or broadcasts.
test("Jayson security override preserves legacy Solana RPC IDs, parameters and responses offline", async () => {
  const requests: {
    id: string;
    method: string;
    params: unknown[];
    jsonrpc: string;
  }[] = [];
  const mockFetch: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    requests.push(request);
    const results: Record<string, unknown> = {
      getGenesisHash: "offline-genesis-fixture",
      getLatestBlockhash: {
        context: { slot: 1 },
        value: {
          blockhash: "11111111111111111111111111111111",
          lastValidBlockHeight: 100,
        },
      },
      getMultipleAccounts: { context: { slot: 1 }, value: [null] },
      getTransaction: null,
    };
    assert.ok(request.method in results, "Unexpected RPC fixture method");
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: results[request.method],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const rpc = new Connection("https://offline.invalid", {
    commitment: "finalized",
    fetch: mockFetch,
    disableRetryOnRateLimit: true,
  });
  assert.equal(await rpc.getGenesisHash(), "offline-genesis-fixture");
  assert.equal((await rpc.getLatestBlockhash()).lastValidBlockHeight, 100);
  assert.deepEqual(
    await rpc.getMultipleAccountsInfo([
      new PublicKey("11111111111111111111111111111111"),
    ]),
    [null],
  );
  assert.equal(
    await rpc.getParsedTransaction("offline-signature-fixture", {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    }),
    null,
  );
  assert.equal(requests.length, 4);
  assert.equal(new Set(requests.map((r) => r.id)).size, 4);
  for (const request of requests) {
    assert.equal(request.jsonrpc, "2.0");
    assert.match(
      request.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  }
  assert.deepEqual(requests[1].params, [{ commitment: "finalized" }]);
  assert.deepEqual(requests[3].params, [
    "offline-signature-fixture",
    {
      encoding: "jsonParsed",
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    },
  ]);
});

test("Jayson security override preserves Solana batch callbacks and propagates RPC errors offline", async () => {
  const mockFetch: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    if (Array.isArray(body))
      return new Response(
        JSON.stringify(
          body.map((request) => ({
            jsonrpc: "2.0",
            id: request.id,
            result: null,
          })),
        ),
      );
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: body.id,
        error: { code: -32000, message: "Offline RPC denied fixture" },
      }),
    );
  };
  const rpc = new Connection("https://offline.invalid", {
    fetch: mockFetch,
    disableRetryOnRateLimit: true,
  });
  assert.deepEqual(
    await rpc.getParsedTransactions(["offline-one", "offline-two"], {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    }),
    [null, null],
  );
  await assert.rejects(
    () => rpc.getGenesisHash(),
    /Offline RPC denied fixture/,
  );
});

test("Reown's nested legacy Solana SDKs retain their RPC bridge after the Jayson override", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  for (const parent of [
    "@reown/appkit-adapter-solana",
    "@solana/buffer-layout-utils",
  ]) {
    const parentRequire = createRequire(require.resolve(parent));
    const nested = parentRequire(
      "@solana/web3.js",
    ) as typeof import("solana-web3-legacy");
    let calls = 0;
    const mockFetch: typeof fetch = async (_input, init) => {
      calls++;
      const request = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify(
          Array.isArray(request)
            ? request.map((r) => ({ jsonrpc: "2.0", id: r.id, result: null }))
            : {
                jsonrpc: "2.0",
                id: request.id,
                result: "offline-nested-genesis",
              },
        ),
      );
    };
    const rpc = new nested.Connection("https://offline.invalid", {
      fetch: mockFetch,
    });
    assert.equal(await rpc.getGenesisHash(), "offline-nested-genesis", parent);
    assert.deepEqual(
      await rpc.getParsedTransactions(["offline-one", "offline-two"], {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      }),
      [null, null],
      parent,
    );
    assert.equal(calls, 2, parent);
  }
});
