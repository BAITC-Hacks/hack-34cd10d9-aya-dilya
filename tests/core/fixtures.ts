import type { Contractor } from "../../src/core/model";
import type { SmartRecommendationRequest } from "../../src/shared/contracts";

/** Unit-test records only: never part of the product catalog. */
export function contractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: "TEST-01", name: "Тестовый профиль", city: "Алматы",
    categories: ["Ведущий"], eventFormats: ["корпоратив"], languages: ["русский"],
    priceFromKzt: 100000, maxHours: 6, busyDates: [],
    description: "Стиль ведения: импровизация и интерактивы с гостями.",
    synthetic: true, cityImputed: false, priceImputed: false,
    ...overrides,
  };
}

export function request(overrides: Partial<SmartRecommendationRequest> = {}): SmartRecommendationRequest {
  return { city: "Алматы", category: "Ведущий", eventFormat: "корпоратив", date: "2026-10-10", budgetKzt: 100000, ...overrides };
}
