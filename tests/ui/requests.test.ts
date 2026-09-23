import test from "node:test";
import assert from "node:assert/strict";
import { createLatestRequestRunner, createHttpAdapter } from "../../src/pages/recommendationServiceAdapter";
import { recommendationService } from "../../src/core/index";
import type { RecommendationResponse, RecommendationService } from "../../src/shared/contracts";
import examples from "../../src/data/demo-queries.json";

function deferred() {
  let resolve!: (result: RecommendationResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<RecommendationResponse>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const request = examples.scenarios[0].request;
const oldResult: RecommendationResponse = { status: "no_match", cards: [], summary: "old" };
const newResult: RecommendationResponse = { status: "category_absent", cards: [], summary: "new" };

for (const staleFailure of [false, true]) test(`ignores stale ${staleFailure ? 'error' : 'success'} after a newer result`, async () => {
  const first = deferred(); const second = deferred(); let calls = 0;
  const service: RecommendationService = { getCatalogOptions: recommendationService.getCatalogOptions, recommend: () => (++calls === 1 ? first : second).promise };
  const runner = createLatestRequestRunner(service); const published: unknown[] = [];
  const old = runner.run(request, x => published.push(x), e => published.push(e));
  const latest = runner.run({ ...request, budgetKzt: 0 }, x => published.push(x), e => published.push(e));
  second.resolve(newResult); await latest;
  if (staleFailure) first.reject(new Error("stale")); else first.resolve(oldResult);
  await old; assert.deepEqual(published, [newResult]);
});

test("invalidating a pending request prevents both callbacks", async () => {
  const pending = deferred(); const runner = createLatestRequestRunner({ ...recommendationService, recommend: () => pending.promise });
  let publications = 0;
  const done = runner.run(request, () => publications++, () => publications++);
  runner.invalidate(); pending.resolve(oldResult); await done; assert.equal(publications, 0);
});

test("current technical failure is reported rather than converted to no_match", async () => {
  const failure = new Error("unavailable"); let received: unknown;
  const runner = createLatestRequestRunner({ ...recommendationService, recommend: async () => { throw failure; } });
  await runner.run(request, () => assert.fail("unexpected result"), error => { received = error; });
  assert.equal(received, failure);
});

test("HTTP adapter returns every saved scenario unchanged", async () => {
  const serviceAdapter = createHttpAdapter(async (_, init) => new Response(JSON.stringify(await recommendationService.recommend(JSON.parse(String(init?.body))))));
  assert.deepEqual(serviceAdapter.getCatalogOptions(), recommendationService.getCatalogOptions());
  for (const scenario of examples.scenarios) {
    const result = await serviceAdapter.recommend(scenario.request);
    assert.equal(result.status, scenario.expected.status);
    assert.deepEqual(result.cards.map(card => card.id), scenario.expected.ids);
    assert.deepEqual(result, await recommendationService.recommend(scenario.request));
  }
});
