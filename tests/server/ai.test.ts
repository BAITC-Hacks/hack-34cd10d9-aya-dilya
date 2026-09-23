import assert from "node:assert/strict";
import { test } from "node:test";
import { createAiExplainer, buildCandidateFacts, validateAiOutput } from "../../server/ai-explanations";
import { recommend } from "../../src/core/index";
import { smartExamples } from "../../src/data/smart-examples";

const request = smartExamples[0].request;
const baseline = await recommend(request);
const candidates = buildCandidateFacts(request, baseline);
const output = () => ({ cards: candidates.map(c => ({ id: c.id,
  explanation: c.facts.find(f => f.id.startsWith("theme:"))?.text ?? c.facts.find(f => f.id === "description")!.text,
  evidenceIds: c.facts.filter(f => f.id.startsWith("theme:") || f.id === "description").map(f => f.id),
})) });
const response = (value: unknown) => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }));

test("no key and empty results never call OpenAI", async () => {
  const fetcher: typeof fetch = async () => { throw new Error("Unexpected network"); };
  assert.equal((await createAiExplainer({ fetcher })(request, baseline)).ai?.reason, "not_configured");
  assert.equal((await createAiExplainer({ apiKey: "test", fetcher })(request, { status: "no_match", cards: [], summary: "Нет" })).ai?.mode, "rules");
});

test("Responses request is server-only, structured, cached and preserves selected facts", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(init!.body as string);
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer test");
    return response(output());
  };
  const explain = createAiExplainer({ apiKey: "test", fetcher });
  const [first, concurrent] = await Promise.all([explain(request, baseline), explain(request, baseline)]);
  assert.equal(first.ai?.mode, "openai"); assert.equal(concurrent.ai?.mode, "openai");
  assert.deepEqual(first.cards.map(c => [c.id, c.priceFromKzt, c.availability]), baseline.cards.map(c => [c.id, c.priceFromKzt, c.availability]));
  first.cards[0].name = "mutated";
  const cached = await explain(request, baseline);
  assert.equal(cached.ai?.cached, true); assert.equal(calls, 1);
  assert.equal(cached.cards[0].name, baseline.cards[0].name);
  assert.ok(cached.cards[0].aiEvidence?.length);
});

test("malformed answers, refusals, provider errors and timeouts fall back to original explanations", async () => {
  const fetchers: (typeof fetch)[] = [
    async () => new Response("", { status: 429 }),
    async () => response({ cards: [] }),
    async () => new Response(JSON.stringify({ status: "incomplete", output: [] })),
    async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] })),
    async () => { throw new DOMException("Timed out", "TimeoutError"); },
  ];
  for (const fetcher of fetchers) {
    const result = await createAiExplainer({ apiKey: "test", fetcher })(request, baseline);
    assert.equal(result.ai?.mode, "rules"); assert.deepEqual(result.cards, baseline.cards);
  }
});

test("reject fabricated references, numbers, ratings, fixed prices and unsupported availability", () => {
  assert.equal(validateAiOutput(output(), candidates).length, candidates.length);
  for (const text of ["Имеет рейтинг 9 и превосходные отзывы клиентов.", "Автор профиля провёл 987654321 мероприятий для компаний.", `Стоимость мероприятия ${candidates[0].priceFromKzt} тенге, автор описывает технологические форумы.`, "Этот ведущий свободен в указанную дату вашего мероприятия."]) {
    const value = output(); value.cards[0].explanation = text;
    assert.throws(() => validateAiOutput(value, candidates));
  }
  const bad = output(); bad.cards[0].evidenceIds = ["invented-review"];
  assert.throws(() => validateAiOutput(bad, candidates));
  const duplicate = output(); duplicate.cards[1].id = duplicate.cards[0].id;
  assert.throws(() => validateAiOutput(duplicate, candidates));
});
