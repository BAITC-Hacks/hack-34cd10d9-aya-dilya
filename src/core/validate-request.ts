import { RequestValidationError, type SmartRecommendationRequest, type ValidationIssue } from "../shared/contracts";
import { CALENDAR_RANGE, isCalendarDate } from "./model";

export function validateRequest(value: unknown): SmartRecommendationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestValidationError([{ field: "request", message: "Передайте параметры мероприятия." }]);
  }
  const input = value as Record<string, unknown>;
  const issues: ValidationIssue[] = [];
  for (const [field, label] of [
    ["city", "город"], ["category", "категорию"], ["eventFormat", "формат мероприятия"],
  ] as const) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      issues.push({ field, message: `Укажите ${label}.` });
    }
  }
  if (!isCalendarDate(input.date)) {
    issues.push({ field: "date", message: "Укажите существующую дату в формате YYYY-MM-DD." });
  } else if (input.date < CALENDAR_RANGE.min || input.date > CALENDAR_RANGE.max) {
    issues.push({ field: "date", message: "Календарь доступен только с 23.09.2026 по 31.12.2026 включительно." });
  }
  if (typeof input.budgetKzt !== "number" || !Number.isSafeInteger(input.budgetKzt) || input.budgetKzt < 0) {
    issues.push({ field: "budgetKzt", message: "Бюджет должен быть целым неотрицательным числом тенге." });
  }
  if (input.language !== undefined && (typeof input.language !== "string" || !input.language.trim())) {
    issues.push({ field: "language", message: "Укажите язык или оставьте параметр не заданным." });
  }
  if (input.durationHours !== undefined && (typeof input.durationHours !== "number" ||
      !Number.isFinite(input.durationHours) || input.durationHours <= 0 || input.durationHours > Number.MAX_SAFE_INTEGER)) {
    issues.push({ field: "durationHours", message: "Длительность должна быть положительным числом часов." });
  }
  if (input.preferences !== undefined && (typeof input.preferences !== "string" || input.preferences.length > 500)) {
    issues.push({ field: "preferences", message: "Пожелания должны быть текстом длиной до 500 символов." });
  }
  if (issues.length) throw new RequestValidationError(issues);
  return {
    city: (input.city as string).trim(),
    category: (input.category as string).trim(),
    eventFormat: (input.eventFormat as string).trim(),
    date: input.date as string,
    budgetKzt: input.budgetKzt as number,
    ...(input.language === undefined ? {} : { language: (input.language as string).trim() }),
    ...(input.durationHours === undefined ? {} : { durationHours: input.durationHours as number }),
    ...(typeof input.preferences === "string" && input.preferences.trim() ? { preferences: input.preferences.trim() } : {}),
  };
}
