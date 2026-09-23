import { writeFile } from "node:fs/promises";
import catalog from "../src/data/catalog.json";
import { recommend } from "../src/core/index";
import { analyzeMatches } from "../src/core/matching";
import type { RecommendationRequest } from "../src/shared/contracts";

const dates = Array.from({ length: 100 }, (_, index) => {
  const day = new Date("2026-09-23T00:00:00Z"); day.setUTCDate(day.getUTCDate() + index);
  return day.toISOString().slice(0, 10);
});
function findDate(base: RecommendationRequest, condition: (request: RecommendationRequest) => boolean): RecommendationRequest {
  const date = dates.find((date) => condition({ ...base, date }));
  if (!date) throw new Error(`Не найден сценарий: ${JSON.stringify(base)}`);
  return { ...base, date };
}
const dense = findDate({ city: "Алматы", category: "Ведущий", eventFormat: "корпоратив", budgetKzt: 2000000, date: "" },
  (r) => r.date >= "2026-10-01" && r.date <= "2026-11-30" && analyzeMatches(catalog.profiles, r).eligible.length > 3);
const firstIds = (await recommend(dense)).cards.map((c) => c.id);
const otherDate = findDate(dense, (r) => r.date > dense.date && r.date <= "2026-11-30" &&
  analyzeMatches(catalog.profiles, r).eligible.length > 0 && firstIds.some((id) =>
    catalog.profiles.find((p) => p.id === id)!.busyDates.includes(r.date)));
const rare = findDate({ city: "Алматы", category: "Флорист", eventFormat: "свадьба", budgetKzt: 350000, date: "" },
  (r) => analyzeMatches(catalog.profiles, r).eligible.length === 2);
const busy = findDate({ city: "Астана", category: "Флорист", eventFormat: "корпоратив", budgetKzt: 350000, date: "" },
  (r) => r.date.startsWith("2026-12") && analyzeMatches(catalog.profiles, r).candidates.every((c) =>
    c.reasons.length === 1 && c.reasons[0] === "busy"));
const venue = findDate({ city: "Алматы", category: "Банкетный зал", eventFormat: "корпоратив", budgetKzt: 6000000, date: "", language: "русский", durationHours: 8 },
  (r) => analyzeMatches(catalog.profiles, r).eligible.length >= 3);
const definitions = [
  { key: "dense-autumn", label: "Плотная категория: ранжирование более трёх кандидатов", request: dense },
  { key: "different-date", label: "Тот же запрос на другую дату", request: otherDate },
  { key: "rare-category", label: "Редкая категория: всего два профиля в городе", request: rare },
  { key: "category-absent", label: "В городе нет категории", request: { ...dense, city: "Астана", category: "Лайв-бэнд" } },
  { key: "budget-no-match", label: "Категория есть, бюджет исключает всех", request: { ...dense, budgetKzt: 0 } },
  { key: "all-busy", label: "Декабрь: все кандидаты заняты", request: busy },
  { key: "venue", label: "Площадка: календарь, язык и длительность", request: venue },
  { key: "duration-not-applicable", label: "Флорист: длительность присутствия неприменима", request: { ...rare, durationHours: 24, language: "русский" } },
];
const scenarios = [];
for (const definition of definitions) {
  const result = await recommend(definition.request);
  const analysis = analyzeMatches(catalog.profiles, definition.request);
  scenarios.push({ ...definition, expected: {
    status: result.status, ids: result.cards.map((card) => card.id),
    candidateCount: analysis.candidates.length, eligibleCount: analysis.eligible.length,
  } });
}
const fixture = {
  sourceSha256: catalog.sourceSha256,
  dateChange: {
    fromKey: "dense-autumn", toKey: "different-date",
    removedBusyIds: firstIds.filter((id) => catalog.profiles.find((p) => p.id === id)!.busyDates.includes(otherDate.date)),
  },
  scenarios,
};
await writeFile(new URL("../src/data/demo-queries.json", import.meta.url), JSON.stringify(fixture, null, 2) + "\n");
console.log(JSON.stringify(fixture, null, 2));
