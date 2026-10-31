const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function setup(fetch) {
  const output = ts.transpileModule(fs.readFileSync(require.resolve("../lib/api.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, process: { env: {} }, fetch });
  return exports.api;
}
const response = () => ({ ok: true, text: async () => '[{"id":"piece"}]' });

test("overlapping public reads reach every consumer with one request, then revalidate", async () => {
  let calls = 0;
  let release;
  const api = setup(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  const first = api("/products");
  const second = api("/products");
  assert.equal(calls, 1);
  release(response());
  const results = await Promise.all([first, second]);
  assert.equal(results[0][0].id, "piece");
  assert.equal(results[1][0].id, "piece");
  const fresh = api("/products");
  assert.equal(calls, 2);
  release(response());
  await fresh;
});

test("personal reads are independent and GETs omit JSON content-type", async () => {
  const requests = [];
  const api = setup(async (_url, options) => { requests.push(options); return response(); });
  await Promise.all([api("/cart"), api("/cart")]);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers["Content-Type"], undefined);
  assert.equal(requests[0].credentials, "include");
  await api("/cart", { method: "POST", body: "{}" });
  assert.equal(requests[2].headers["Content-Type"], "application/json");
});

test("failed public reads can be retried", async () => {
  let calls = 0;
  const api = setup(async () => { if (++calls === 1) throw new Error("offline"); return response(); });
  await assert.rejects(api("/settings"), { code: "API_UNAVAILABLE" });
  assert.equal((await api("/settings"))[0].id, "piece");
  assert.equal(calls, 2);
});
