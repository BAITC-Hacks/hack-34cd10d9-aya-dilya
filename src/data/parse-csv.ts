/** Build-time CSV loader. Not imported into the browser service. */
import { parse } from "csv-parse/sync";
import { CALENDAR_RANGE, isCalendarDate, normalizeLabel, type Contractor } from "../core/model";

export const CSV_COLUMNS = [
  "id", "anon_name", "categories", "city", "city_imputed", "synthetic",
  "price_from_kzt", "price_imputed", "event_formats", "languages", "max_hours",
  "busy_dates", "description",
] as const;

function required(value: string, field: string): string {
  if (!value.trim()) throw new Error(`Пустое обязательное поле ${field}`);
  return value.trim();
}

function list(value: string, field: string, allowEmpty = false): string[] {
  if (allowEmpty && !value.trim()) return [];
  const items = value.split("|").map((item) => required(item, field));
  if (new Set(items.map(normalizeLabel)).size !== items.length) {
    throw new Error(`Повтор в списке ${field}`);
  }
  return items;
}

function flag(value: string, field: string): boolean {
  if (value === "True") return true;
  if (value === "False") return false;
  throw new Error(`Ожидалось True/False в ${field}`);
}

function number(value: string, field: string, allowZero: boolean): number {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) throw new Error(`Некорректное число ${field}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER ||
      (allowZero ? parsed < 0 : parsed <= 0)) throw new Error(`Недопустимое число ${field}`);
  return parsed;
}

export function parseCatalogCsv(csv: string): Contractor[] {
  let header: string[] = [];
  // Parse arrays first: CSV contents cannot supply object property names.
  const rows = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    columns: false,
    relax_column_count: false,
  }) as string[][];
  if (rows.length < 2) throw new Error("Каталог не содержит профилей");
  header = rows.shift()!;
  if (header.length !== CSV_COLUMNS.length || new Set(header).size !== header.length ||
      CSV_COLUMNS.some((column) => !header.includes(column))) {
    throw new Error("Заголовок CSV не соответствует контракту каталога");
  }
  const ids = new Set<string>();
  return rows.map((values, index) => {
    const get = (column: typeof CSV_COLUMNS[number]) => values[header.indexOf(column)];
    try {
      const id = required(get("id"), "id");
      if (ids.has(id)) throw new Error(`Повтор id ${id}`);
      ids.add(id);
      const busyDates = list(get("busy_dates"), "busy_dates", true);
      for (const date of busyDates) {
        if (!isCalendarDate(date) || date < CALENDAR_RANGE.min || date > CALENDAR_RANGE.max) {
          throw new Error(`Дата вне календаря или некорректна: ${date}`);
        }
      }
      const price = number(get("price_from_kzt"), "price_from_kzt", true);
      if (!Number.isSafeInteger(price)) throw new Error("Цена должна быть целым числом тенге");
      required(get("description"), "description");
      return {
        id,
        name: required(get("anon_name"), "anon_name"),
        categories: list(get("categories"), "categories"),
        city: required(get("city"), "city"),
        cityImputed: flag(get("city_imputed"), "city_imputed"),
        synthetic: flag(get("synthetic"), "synthetic"),
        priceFromKzt: price,
        priceImputed: flag(get("price_imputed"), "price_imputed"),
        eventFormats: list(get("event_formats"), "event_formats"),
        languages: list(get("languages"), "languages"),
        maxHours: get("max_hours").trim() === "" ? null : number(get("max_hours"), "max_hours", false),
        busyDates: busyDates.sort(),
        // Preserve the complete original description, including newlines.
        description: get("description"),
      };
    } catch (error) {
      throw new Error(`Профиль ${index + 1}: ${error instanceof Error ? error.message : "ошибка данных"}`);
    }
  });
}
