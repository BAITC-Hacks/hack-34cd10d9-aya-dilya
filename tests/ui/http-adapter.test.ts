import test from "node:test";
import assert from "node:assert/strict";
import { createHttpAdapter } from "../../src/pages/recommendationServiceAdapter";
import { recommendationService } from "../../src/core/index";
import { RequestValidationError } from "../../src/shared/contracts";
import { smartExamples } from "../../src/data/smart-examples";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContractorCard } from "../../src/components/ContractorCard";
const request = smartExamples[0].request;

test("preferences are sent by POST and server AI metadata is preserved", async () => {
  const expected = { ...await recommendationService.recommend(request), ai: { mode: "openai" as const } };
  const service = createHttpAdapter(async (url, init) => {
    assert.equal(url, "/api/recommend"); assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), request);
    assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/json");
    return Response.json(expected);
  });
  assert.deepEqual(await service.recommend(request), expected);
});

test("invalid local input never reaches the API", async () => {
  let calls = 0;
  const service = createHttpAdapter(async () => { calls++; return Response.json({}); });
  await assert.rejects(service.recommend({ ...request, preferences: "x".repeat(501) }), RequestValidationError);
  assert.equal(calls, 0);
});

test("HTTP 400 field errors are retained", async () => {
  const issues = [{ field: "preferences", message: "Проверьте пожелания." }];
  const service = createHttpAdapter(async () => Response.json({ code: "INVALID_REQUEST", issues }, { status: 400 }));
  await assert.rejects(service.recommend(request), error => error instanceof RequestValidationError && JSON.stringify(error.issues) === JSON.stringify(issues));
});

for (const reason of ["network", "http", "json", "timeout"] as const) test(`${reason} failure falls back to real local recommendations with explicit label`, async () => {
  let signal: AbortSignal | undefined;
  const service = createHttpAdapter(async (_, init) => {
    signal = init?.signal as AbortSignal;
    if (reason === "network") throw new Error("offline");
    if (reason === "http") return Response.json({}, { status: 503 });
    if (reason === "json") return new Response("<html>not API</html>");
    return new Promise<Response>(() => {});
  }, 10);
  assert.deepEqual(await service.recommend(request), {
    ...await recommendationService.recommend(request), ai: { mode: "rules", reason: "unavailable" },
  });
  if (reason === "timeout") assert.equal(signal?.aborted, true);
});

test("Plan B remains separate until its request is explicitly submitted", async () => {
  let calls = 0;
  const service = createHttpAdapter(async (_, init) => {
    calls++; return Response.json(await recommendationService.recommend(JSON.parse(String(init?.body))));
  });
  const original = structuredClone(smartExamples[1].request);
  const response = await service.recommend(original);
  assert.equal(calls, 1); assert.deepEqual(response.cards, []); assert.equal(response.status, "no_match");
  assert.equal(original.budgetKzt, 480000);
  const alternative = response.alternatives!.find(option => option.kind === "budget")!;
  assert.equal(alternative.request.budgetKzt, 500000);
  const applied = await service.recommend(alternative.request);
  assert.equal(calls, 2); assert.deepEqual(applied.cards.map(card => card.id), ["HK-88430"]);
});

test("quotes are escaped, unsupported preferences explained and AI facts expandable", async () => {
  const result = await recommendationService.recommend(request);
  const card = { ...result.cards[0], evidence: [{ id: "test", source: "description" as const, label: "Тема", quote: '<script>alert("x")</script>' }], unmatchedPreferences: ["джаз"], aiEvidence: [{ label: "Источник", text: "Факт каталога" }] };
  const html = renderToStaticMarkup(createElement(ContractorCard, { card, index: 0, ai: true }));
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Нет подтверждения в описании: джаз"));
  assert.ok(html.includes("<details")); assert.ok(html.includes("Факт каталога"));
  const rules = renderToStaticMarkup(createElement(ContractorCard, { card, index: 0, ai: false }));
  assert.ok(!rules.includes("На какие факты опирается AI"));
});
