import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseCatalogCsv } from "../src/data/parse-csv";
import { CALENDAR_RANGE, compareText } from "../src/core/model";

const source = new URL("../src/data/raw/contractors.csv", import.meta.url);
const raw = await readFile(source);
const profiles = parseCatalogCsv(raw.toString("utf8"));
if (profiles.length !== 66) throw new Error(`Ожидалось 66 профилей, получено ${profiles.length}`);
const sourceSha256 = createHash("sha256").update(raw).digest("hex");
const count = (values: string[]) => Object.fromEntries(
  [...new Set(values)].sort(compareText).map((value) => [value, values.filter((x) => x === value).length]),
);
const audit = {
  source: "src/data/raw/contractors.csv",
  sourceSha256,
  calendarRange: CALENDAR_RANGE,
  profiles: profiles.length,
  synthetic: profiles.filter((p) => p.synthetic).length,
  cityImputed: profiles.filter((p) => p.cityImputed).length,
  priceImputed: profiles.filter((p) => p.priceImputed).length,
  durationNotApplicable: profiles.filter((p) => p.maxHours === null).length,
  cities: count(profiles.map((p) => p.city)),
  categories: count(profiles.flatMap((p) => p.categories)),
};
const outputs = [
  [new URL("../src/data/catalog.json", import.meta.url), { sourceSha256, profiles }],
  [new URL("../src/data/audit.json", import.meta.url), audit],
] as const;
for (const [path, data] of outputs) {
  const expected = JSON.stringify(data, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== expected) throw new Error(`Устаревший файл: ${path.pathname}`);
  } else await writeFile(path, expected);
}
console.log(`${process.argv.includes("--check") ? "Проверено" : "Подготовлено"}: ${profiles.length} профилей, SHA-256 ${sourceSha256}`);
