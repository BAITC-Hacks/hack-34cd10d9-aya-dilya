import assert from "node:assert/strict";
import { test } from "node:test";
import { recommend } from "../../src/core/index";
import { createRecommendationService } from "../../src/core/service";
import { matchPreferences, requestedThemes } from "../../src/core/preferences";
import catalog from "../../src/data/catalog.json";
import { smartExamples } from "../../src/data/smart-examples";
import { contractor, request } from "./fixtures";
import { RequestValidationError } from "../../src/shared/contracts";

test("IT preference promotes a real technological-forum profile with a verbatim citation", async () => {
  const query = smartExamples[0].request;
  const plain = await recommend({ ...query, preferences: undefined });
  const smart = await recommend(query);
  assert.equal(plain.cards[0].id, "HK-88430");
  assert.equal(smart.cards[0].id, "HK-75012");
  assert.deepEqual(smart.cards.map(c => c.id), ["HK-75012", "HK-88430", "HK-44923"]);
  assert.equal(smart.cards[0].evidence?.[0].id, "technology");
  const source = catalog.profiles.find(p => p.id === "HK-75012")!;
  assert.ok(source.description.includes(smart.cards[0].evidence![0].quote));
  assert.match(smart.cards[0].evidence![0].quote, /технологические форумы/);
  assert.deepEqual(await recommend(query), smart);
});

test("soft preference never admits a busy or unaffordable contractor", async () => {
  const query = smartExamples[0].request;
  const source = catalog.profiles.find(p => p.id === "HK-75012")!;
  const busy = await recommend({ ...query, date: source.busyDates[0] });
  assert.ok(busy.cards.every(c => c.id !== source.id));
  const cheap = await recommend({ ...query, budgetKzt: source.priceFromKzt - 1 });
  assert.ok(cheap.cards.every(c => c.id !== source.id));
  assert.match(cheap.preferenceSummary!, /нет подтверждающих фрагментов/);
});

test("do not infer IT experience from arbitrary substrings or anonymized brand names", () => {
  assert.equal(requestedThemes("Konpeito credit").length, 0);
  assert.equal(requestedThemes("Без IT-тематики").length, 0);
  assert.equal(requestedThemes("Не нужен джаз").length, 0);
  assert.equal(matchPreferences(contractor({ description: "Клиенты: TechnoLeaf и Digital Sakura." }), "IT-корпоратив").length, 0);
  assert.equal(matchPreferences(contractor({ description: "Мы не проводим технологические форумы." }), "IT-корпоратив").length, 0);
});

test("multiple requested themes order by evidence count, then price/id, without input-order effects", async () => {
  const profiles = [
    contractor({ id: "A", priceFromKzt: 90000, description: "Камерные вечера и джазовый репертуар." }),
    contractor({ id: "B", priceFromKzt: 50000, description: "Джазовый репертуар." }),
    contractor({ id: "C", priceFromKzt: 10000, description: "Праздники для всех." }),
  ];
  const query = request({ preferences: "Камерный вечер и джаз" });
  const result = await createRecommendationService(profiles).recommend(query);
  assert.deepEqual(result.cards.map(c => c.id), ["A", "B", "C"]);
  assert.deepEqual(await createRecommendationService([...profiles].reverse()).recommend(query), result);
  assert.deepEqual(result.cards[1].unmatchedPreferences, ["Камерная атмосфера"]);
});

test("unknown preferences remain visible and do not invent a semantic match", async () => {
  const base = await recommend({ ...smartExamples[0].request, preferences: undefined });
  const result = await recommend({ ...smartExamples[0].request, preferences: "Драконы из марципана" });
  assert.deepEqual(result.cards.map(c => c.id), base.cards.map(c => c.id));
  assert.match(result.preferenceSummary!, /Не распознали/);
  await assert.rejects(recommend({ ...smartExamples[0].request, preferences: "x".repeat(501) }), RequestValidationError);
});

test("Plan B exposes the minimum 4.2% increase without changing the main request or cards", async () => {
  const query = { ...smartExamples[1].request };
  const before = structuredClone(query);
  const result = await recommend(query);
  assert.equal(result.status, "no_match"); assert.deepEqual(result.cards, []);
  assert.deepEqual(query, before);
  const option = result.alternatives!.find(a => a.kind === "budget")!;
  assert.equal(option.budgetIncreaseKzt, 20000);
  assert.equal(option.budgetIncreasePercent, 4.2);
  assert.deepEqual(option.request, { ...query, budgetKzt: 500000 });
  const applied = await recommend(option.request);
  assert.equal(applied.status, "matched");
  assert.deepEqual(applied.cards.map(c => c.id), ["HK-88430"]);
});

test("every Plan B alternative changes one field, retains mandatory conditions and has real candidates", async () => {
  const service = createRecommendationService([contractor({ busyDates: ["2026-09-23", "2026-12-31"] })]);
  for (const date of ["2026-09-23", "2026-12-31"]) {
    const query = request({ date, language: "русский", durationHours: 6, preferences: "импровизация" });
    const result = await service.recommend(query);
    assert.ok(result.alternatives!.length > 0 && result.alternatives!.length <= 3);
    for (const alternative of result.alternatives!) {
      assert.deepEqual(alternative.request, { ...query, date: alternative.request.date });
      assert.ok(alternative.request.date >= "2026-09-23" && alternative.request.date <= "2026-12-31");
      assert.ok(Math.abs(alternative.dateOffsetDays!) <= 7);
      const applied = await service.recommend(alternative.request);
      assert.equal(applied.status, "matched"); assert.equal(alternative.candidateCount, 1);
    }
  }
});

test("Plan B labels large budget concessions without combining conditions or dividing by zero", async () => {
  const service = createRecommendationService([contractor({ priceFromKzt: 120000 })]);
  const boundary = await service.recommend(request());
  assert.equal(boundary.alternatives![0].budgetIncreasePercent, 20);
  for (const query of [request({ eventFormat: "свадьба" })]) {
    assert.deepEqual((await service.recommend(query)).alternatives, []);
  }
  const large = await service.recommend(request({ budgetKzt: 99999 }));
  assert.match(large.alternatives![0].description, /Существенное/);
  const zero = await service.recommend(request({ budgetKzt: 0 }));
  assert.equal(zero.alternatives![0].budgetIncreasePercent, undefined);
  assert.equal(zero.alternatives![0].request.budgetKzt, 120000);
  assert.equal((await service.recommend(request({ city: "Астана" }))).alternatives, undefined);
  assert.equal((await service.recommend(request({ budgetKzt: 120000 }))).alternatives, undefined);
});


test("Astana wedding offers an honest budget change instead of silently hiding the alternative", async () => {
  const query = { city: "Астана", date: "2026-09-26", eventFormat: "свадьба", category: "Ведущий", budgetKzt: 400000, language: "русский", durationHours: 6 };
  const result = await recommend(query);
  assert.equal(result.status, "no_match"); assert.equal(result.cards.length, 0);
  const option = result.alternatives![0];
  assert.deepEqual(option.request, { ...query, budgetKzt: 800000 });
  assert.equal(option.budgetIncreasePercent, 100);
  assert.match(option.description, /Существенное/);
  assert.equal((await recommend(option.request)).cards[0].id, "HK-80581");
});

test("Plan B searches beyond one week and prefers the original budget", async () => {
  const busyDates = Array.from({length: 12}, (_, i) => new Date(Date.UTC(2026, 8, 23+i)).toISOString().slice(0,10));
  const service = createRecommendationService([
    contractor({id: "near-price", priceFromKzt: 200000}),
    contractor({id: "later-date", priceFromKzt: 100000, busyDates}),
  ]);
  const result = await service.recommend(request({date:"2026-09-23"}));
  assert.ok(result.alternatives!.every(a => a.kind === "date"));
  assert.equal(result.alternatives![0].dateOffsetDays, 12);
  for (const option of result.alternatives!) {
    assert.equal(option.request.budgetKzt, 100000);
    assert.equal((await service.recommend(option.request)).status, "matched");
  }
});
