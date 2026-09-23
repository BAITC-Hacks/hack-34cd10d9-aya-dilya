import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "../../src/data/catalog.json";
import demos from "../../src/data/demo-queries.json";
import { getCatalogOptions, recommend } from "../../src/core/index";
import { selectDescriptionEvidence } from "../../src/core/explanations";

test("public options cover the original catalog and inclusive date window", () => {
  const options = getCatalogOptions();
  assert.deepEqual(options.cities, ["Алматы", "Астана", "Зарубежье"]);
  assert.equal(options.categories.length, 17);
  assert.equal(options.eventFormats.length, 6);
  assert.equal(options.languages.length, 3);
  assert.deepEqual(options.dateRange, { min: "2026-09-23", max: "2026-12-31" });
});

test("eight saved scenarios remain reproducible on the specified dataset", async () => {
  assert.equal(demos.sourceSha256, catalog.sourceSha256);
  assert.equal(demos.scenarios.length, 8);
  for (const scenario of demos.scenarios) {
    const result = await recommend(scenario.request);
    assert.equal(result.status, scenario.expected.status, scenario.key);
    assert.deepEqual(result.cards.map((c) => c.id), scenario.expected.ids, scenario.key);
    assert.deepEqual(await recommend(scenario.request), result, scenario.key);
    assert.ok(result.summary.length > 0);
    for (const card of result.cards) {
      const profile = catalog.profiles.find((p) => p.id === card.id)!;
      const quote = selectDescriptionEvidence(profile.description, scenario.request.eventFormat);
      if (quote) {
        assert.ok(profile.description.includes(quote));
        assert.ok(card.explanation.includes(quote));
      } else {
        assert.doesNotMatch(card.explanation, /Фрагмент описания/);
        assert.match(card.explanation, /язык|языки/);
        assert.match(card.explanation, /ч на площадке|часов присутствия неприменимо/);
      }
      assert.equal(card.synthetic, profile.synthetic);
      assert.equal(card.priceImputed, profile.priceImputed);
      assert.equal(card.cityImputed, profile.cityImputed);
      assert.equal(card.priceFromKzt, profile.priceFromKzt);
    }
  }
});

test("changing only the date removes previously shown contractors because they are busy", async () => {
  const before = demos.scenarios.find((s) => s.key === demos.dateChange.fromKey)!;
  const after = demos.scenarios.find((s) => s.key === demos.dateChange.toKey)!;
  assert.deepEqual({ ...before.request, date: after.request.date }, after.request);
  assert.ok(demos.dateChange.removedBusyIds.length > 0);
  const result = await recommend(after.request);
  for (const id of demos.dateChange.removedBusyIds) {
    const profile = catalog.profiles.find((p) => p.id === id)!;
    assert.ok(before.expected.ids.includes(id));
    assert.ok(!profile.busyDates.includes(before.request.date));
    assert.ok(profile.busyDates.includes(after.request.date));
    assert.ok(!result.cards.some((card) => card.id === id));
  }
  assert.match(result.summary, /заняты на выбранную дату/);
});

test("dense demo explanations remain distinct after removing names", async () => {
  const scenario = demos.scenarios.find((s) => s.key === "dense-autumn")!;
  assert.ok(scenario.expected.eligibleCount > 3);
  const result = await recommend(scenario.request);
  const texts = result.cards.map((card) => {
    let text = card.explanation;
    for (const p of catalog.profiles) text = text.replaceAll(p.name, "");
    return text;
  });
  assert.equal(new Set(texts).size, 3);
  const evidence = result.cards.map((card) => selectDescriptionEvidence(catalog.profiles.find((p) => p.id === card.id)!.description, scenario.request.eventFormat));
  assert.equal(new Set(evidence).size, 3);
});

test("6,600 real-catalog requests obey constraints across the entire 100-day calendar", async () => {
  let checked = 0;
  for (let day = 0; day < 100; day++) {
    const date = new Date("2026-09-23T00:00:00Z"); date.setUTCDate(date.getUTCDate() + day);
    for (const profile of catalog.profiles) {
      const request = {
        city: profile.city,
        category: profile.categories[day % profile.categories.length],
        eventFormat: profile.eventFormats[day % profile.eventFormats.length],
        date: date.toISOString().slice(0, 10),
        budgetKzt: profile.priceFromKzt,
        ...(day % 2 ? { language: profile.languages[0] } : {}),
        ...(day % 3 ? { durationHours: profile.maxHours ?? 24 } : {}),
      };
      // Independent eligibility oracle over the source snapshot, without core helpers.
      const eligible = catalog.profiles.filter((p) =>
        p.city === request.city && p.categories.includes(request.category) &&
        !p.busyDates.includes(request.date) && p.eventFormats.includes(request.eventFormat) &&
        p.priceFromKzt <= request.budgetKzt &&
        (request.language === undefined || p.languages.includes(request.language)) &&
        (request.durationHours === undefined || p.maxHours === null || p.maxHours >= request.durationHours));
      const result = await recommend(request);
      assert.equal(result.status, eligible.length ? "matched" : "no_match");
      assert.equal(result.cards.length, Math.min(3, eligible.length));
      assert.equal(new Set(result.cards.map((c) => c.id)).size, result.cards.length);
      for (const card of result.cards) assert.ok(eligible.some((p) => p.id === card.id), card.id);
      checked++;
    }
  }
  assert.equal(checked, 6600);
});
