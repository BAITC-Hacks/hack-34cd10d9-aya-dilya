import type { PlanBOption, SmartRecommendationRequest } from "../shared/contracts";
import { analyzeMatches } from "./matching";
import { CALENDAR_RANGE, type Contractor } from "./model";
import { formatDate, formatKzt } from "./explanations";

/** One change per suggestion. Never alters the original request or main cards. */
export function suggestPlanB(profiles: readonly Contractor[], request: SmartRecommendationRequest): PlanBOption[] {
  const original = analyzeMatches(profiles, request);
  if (original.eligible.length || !original.candidates.length) return [];
  const options: PlanBOption[] = [];
  const budgetCandidates = original.candidates.filter((c) => c.reasons.length === 1 && c.reasons[0] === "budget")
    .map((c) => c.profile).sort((a, b) => a.priceFromKzt - b.priceFromKzt);
  const price = budgetCandidates[0]?.priceFromKzt;
  let largerBudget: PlanBOption | undefined;
  if (price !== undefined) {
    const revised = { ...request, budgetKzt: price };
    const eligible = analyzeMatches(profiles, revised).eligible;
    const increase = price - request.budgetKzt;
    const percent = request.budgetKzt > 0 ? Math.round(increase / request.budgetKzt * 1000) / 10 : undefined;
    const substantial = request.budgetKzt === 0 || increase > request.budgetKzt * 0.2;
    const option: PlanBOption = { id: `budget-${price}`, kind: "budget", title: `Бюджет ${formatKzt(price)}${percent === undefined ? "" : ` (+${percent}%)`}`,
      description: `${substantial ? "Существенное изменение бюджета. " : ""}Увеличение на ${formatKzt(increase)}; остальные условия сохраняются. Начальная цена не является итоговой сметой.`,
      request: revised, candidateCount: eligible.length, candidateNames: eligible.slice(0, 3).map((p) => p.name),
      budgetIncreaseKzt: increase, ...(percent === undefined ? {} : { budgetIncreasePercent: percent }) };
    if (substantial) largerBudget = option; else options.push(option);
  }
  let dateSuggestions = 0;
  for (let distance = 1; distance <= 99 && dateSuggestions < 2; distance++) {
    for (const offset of [distance, -distance]) {
      const date = new Date(`${request.date}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const iso = date.toISOString().slice(0, 10);
      if (iso < CALENDAR_RANGE.min || iso > CALENDAR_RANGE.max) continue;
      const revised = { ...request, date: iso };
      const eligible = analyzeMatches(profiles, revised).eligible;
      if (!eligible.length) continue;
      options.push({ id: `date-${iso}`, kind: "date", title: `Дата ${formatDate(iso)}`,
        description: `Сдвиг на ${offset > 0 ? "+" : ""}${offset} дн.; бюджет, категория и остальные условия сохраняются.`,
        request: revised, candidateCount: eligible.length, candidateNames: eligible.slice(0, 3).map((p) => p.name), dateOffsetDays: offset });
      if (++dateSuggestions === 2) break;
    }
  }
  // Prefer a change of date within the original budget over a large increase.
  if (!options.length && largerBudget) options.push(largerBudget);
  return options;
}
