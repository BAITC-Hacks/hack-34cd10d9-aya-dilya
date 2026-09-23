import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import catalog from "../../src/data/catalog.json";
import audit from "../../src/data/audit.json";
import { CSV_COLUMNS, parseCatalogCsv } from "../../src/data/parse-csv";

const raw = readFileSync(new URL("../../src/data/raw/contractors.csv", import.meta.url));
const row = ["TEST-CSV", "Профиль, с запятой", "Банкетный зал|Отель", "Алматы", "False", "True", "100000", "False",
  "свадьба|корпоратив", "русский|казахский", "", "2026-10-10|2026-12-31", 'Текст с "кавычками", запятой\nи переносом.'];
function csv(rows = [row], columns: readonly string[] = CSV_COLUMNS): string {
  return [columns, ...rows].map((cells) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
}
function changed(field: typeof CSV_COLUMNS[number], value: string): string[] {
  const result = [...row]; result[CSV_COLUMNS.indexOf(field)] = value; return result;
}

test("all 66 source records match the generated snapshot and checksum", () => {
  assert.equal(catalog.profiles.length, 66);
  assert.equal(new Set(catalog.profiles.map((p) => p.id)).size, 66);
  assert.deepEqual(parseCatalogCsv(raw.toString("utf8")), catalog.profiles);
  assert.equal(createHash("sha256").update(raw).digest("hex"), catalog.sourceSha256);
  assert.equal(audit.sourceSha256, catalog.sourceSha256);
  assert.deepEqual(audit.cities, { "Алматы": 50, "Астана": 15, "Зарубежье": 1 });
  assert.equal(audit.synthetic, 13);
  assert.equal(audit.cityImputed, 8);
  assert.equal(audit.priceImputed, 18);
  assert.equal(audit.durationNotApplicable, 9);
  assert.equal(audit.categories["Банкетный зал"], 8);
});

test("standard CSV parsing preserves quotes/newlines and parses flags, lists and null", () => {
  const [p] = parseCatalogCsv("\uFEFF" + csv());
  assert.equal(p.name, "Профиль, с запятой");
  assert.equal(p.description, row[12]);
  assert.deepEqual(p.categories, ["Банкетный зал", "Отель"]);
  assert.deepEqual(p.languages, ["русский", "казахский"]);
  assert.equal(p.cityImputed, false);
  assert.equal(p.priceImputed, false);
  assert.equal(p.synthetic, true);
  assert.equal(p.maxHours, null);
  assert.equal(p.priceFromKzt, 100000);
});

test("invalid CSV values fail explicitly instead of silently dropping records", () => {
  for (const [field, value] of [
    ["city_imputed", "false"], ["synthetic", "1"], ["price_from_kzt", "-1"],
    ["price_from_kzt", "1.5"], ["max_hours", "0"], ["max_hours", "null"],
    ["busy_dates", "2026-11-31"], ["busy_dates", "2027-01-01"],
    ["categories", "Отель|Отель"], ["categories", "Отель|"], ["description", ""],
  ] as const) assert.throws(() => parseCatalogCsv(csv([changed(field, value)])), /Профиль 1/);
  assert.throws(() => parseCatalogCsv(csv([row, row])), /Повтор id/);
  assert.throws(() => parseCatalogCsv(csv([row], CSV_COLUMNS.map((c) => c === "id" ? "__proto__" : c))), /Заголовок/);
  assert.throws(() => parseCatalogCsv(""), /не содержит/);
  assert.throws(() => parseCatalogCsv(csv([row.slice(0, -1)])));
});

test("empty busy_dates is a valid calendar with no marked busy days", () => {
  assert.deepEqual(parseCatalogCsv(csv([changed("busy_dates", "")]))[0].busyDates, []);
});
