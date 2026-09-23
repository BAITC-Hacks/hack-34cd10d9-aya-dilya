import assert from "node:assert/strict";
import { smartExamples } from "../src/data/smart-examples";
import type { RecommendationResponse, SmartRecommendationRequest } from "../src/shared/contracts";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4173");
if (!["http:", "https:"].includes(base.protocol)) throw new Error("HTTP(S) URL required");
async function get(path: string) { return fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) }); }
async function post(request: SmartRecommendationRequest) {
  const http = await fetch(new URL("/api/recommend", base), { method: "POST", headers: { "Content-Type": "application/json", Origin: base.origin }, body: JSON.stringify(request), signal: AbortSignal.timeout(15000) });
  return { status: http.status, body: await http.json() as RecommendationResponse };
}
assert.equal((await get("/healthz")).status, 200, "Health check");
assert.match(await (await get("/")).text(), /id="root"/, "App HTML");
const smart = await post(smartExamples[0].request);
assert.equal(smart.status, 200);
assert.deepEqual(smart.body.cards.map(c => c.id), ["HK-75012", "HK-88430", "HK-44923"]);
const empty = await post(smartExamples[1].request);
assert.equal(empty.body.status, "no_match"); assert.equal(empty.body.cards.length, 0);
const alternative = empty.body.alternatives!.find(a => a.kind === "budget")!;
assert.equal(alternative.request.budgetKzt, 500000);
assert.deepEqual((await post(alternative.request)).body.cards.map(c => c.id), ["HK-88430"]);
assert.equal((await post({ ...smartExamples[0].request, date: "2027-01-01" })).status, 400);
console.log(JSON.stringify({ status: "passed", origin: base.origin, checks: ["health", "page", "IT ranking", "Plan B", "apply budget", "validation"], aiMode: smart.body.ai?.mode, aiReason: smart.body.ai?.reason }, null, 2));
