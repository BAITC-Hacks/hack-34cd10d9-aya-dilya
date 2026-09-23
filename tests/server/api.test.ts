import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiHandler } from "../../server/api";
import { smartExamples } from "../../src/data/smart-examples";

async function call(handler: ReturnType<typeof createApiHandler>, body: string, overrides: Record<string, unknown> = {}) {
  const req = Object.assign(Readable.from([Buffer.from(body)]), {
    method: "POST", url: "/api/recommend", headers: { host: "localhost", "content-type": "application/json" },
    socket: { remoteAddress: "127.0.0.1" }, ...overrides,
  });
  let status = 0; let data = "";
  const res = { writeHead(code: number) { status = code; }, end(value: string) { data = value; } };
  const handled = await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
  return { handled, status, body: data ? JSON.parse(data) : undefined };
}

test("API returns real recommendations without a key and separates invalid requests", async () => {
  const handler = createApiHandler();
  const result = await call(handler, JSON.stringify(smartExamples[0].request));
  assert.equal(result.status, 200); assert.equal(result.body.cards[0].id, "HK-75012");
  assert.equal(result.body.ai.reason, "not_configured");
  const invalid = await call(handler, JSON.stringify({ ...smartExamples[0].request, date: "2027-01-01" }));
  assert.equal(invalid.status, 400); assert.equal(invalid.body.code, "INVALID_REQUEST");
  assert.equal((await call(handler, "{")).status, 400);
});

test("API rejects wrong methods, cross-origin requests, large bodies and excess calls", async () => {
  const handler = createApiHandler();
  assert.equal((await call(handler, "", { method: "GET" })).status, 405);
  assert.equal((await call(handler, "", { headers: { origin: "https://other.example", host: "localhost" } })).status, 403);
  assert.equal((await call(handler, "", { headers: {} })).status, 415);
  assert.equal((await call(handler, "x".repeat(8193))).status, 413);
  assert.equal((await call(handler, "", { url: "/other" })).handled, false);
  for (let i = 0; i < 29; i++) await call(handler, "{");
  assert.equal((await call(handler, "{")).status, 429);
});
