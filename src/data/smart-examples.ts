import type { SmartRecommendationRequest } from "../shared/contracts";

/** Requests against the original dataset, never canned responses. */
export const smartExamples: { key: string; label: string; request: SmartRecommendationRequest }[] = [
  { key: "smart-it", label: "Умный подбор: IT-корпоратив", request: {
    city: "Алматы", date: "2026-10-01", category: "Ведущий", eventFormat: "корпоратив", budgetKzt: 2000000, preferences: "IT-корпоратив",
  } },
  { key: "smart-plan-b", label: "План Б: бюджет выше всего на 4,2%", request: {
    city: "Алматы", date: "2026-10-10", category: "Ведущий", eventFormat: "корпоратив", budgetKzt: 480000,
  } },
];
