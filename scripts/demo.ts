import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import fixtures from "../src/data/demo-queries.json";

const importStart = performance.now();
const { recommend } = await import("../src/core/index");
const moduleLoadMs = performance.now() - importStart;
let firstRequestMs = 0;
for (const [index, scenario] of fixtures.scenarios.entries()) {
  const started = performance.now();
  const response = await recommend(scenario.request);
  if (index === 0) firstRequestMs = performance.now() - started;
  assert.equal(response.status, scenario.expected.status);
  assert.deepEqual(response.cards.map((c) => c.id), scenario.expected.ids);
  console.log(`\n${scenario.key}: ${scenario.label}`);
  console.log(JSON.stringify(scenario.request));
  console.log(response.summary);
  for (const card of response.cards) console.log(`${card.id} · ${card.name}\n${card.explanation}`);
}
const times: number[] = [];
for (let run = 0; run < 100; run++) {
  const started = performance.now();
  await recommend(fixtures.scenarios[run % fixtures.scenarios.length].request);
  times.push(performance.now() - started);
}
times.sort((a, b) => a - b);
console.log("\nИзмерения локального сервиса без UI и без внешнего API (мс):", JSON.stringify({
  moduleLoad: +moduleLoadMs.toFixed(3), firstRequest: +firstRequestMs.toFixed(3),
  warmMedian: +times[49].toFixed(3), warmP95: +times[94].toFixed(3), warmMax: +times[99].toFixed(3), samples: times.length,
}));
console.log("В паре дат занятость исключает:", fixtures.dateChange.removedBusyIds.join(", "));
