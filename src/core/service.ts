import {
  RecommendationServiceError, RequestValidationError,
  type CatalogOptions, type SmartRecommendationRequest, type RecommendationResponse,
  type RecommendationService,
} from "../shared/contracts";
import { CALENDAR_RANGE, compareText, normalizeLabel, type Contractor } from "./model";
import { analyzeMatches } from "./matching";
import { explainMatch, explainSummary } from "./explanations";
import { validateRequest } from "./validate-request";
import { matchPreferences, requestedThemes, summarizePreferences } from "./preferences";
import { suggestPlanB } from "./plan-b";

/** Pass profiles validated by the CSV loader. The service owns a private snapshot. */
export function createRecommendationService(source: readonly Contractor[]): RecommendationService {
  let profiles: Contractor[];
  try {
    profiles = structuredClone([...source]);
    if (!profiles.length || profiles.some((p) => !p.id) || new Set(profiles.map((p) => p.id)).size !== profiles.length) {
      throw new Error("Empty catalog or duplicate ids");
    }
  } catch {
    throw new RecommendationServiceError("Не удалось загрузить каталог подрядчиков.");
  }
  const values = (items: string[]) => [...new Set(items)].sort(compareText);
  return {
    getCatalogOptions(): CatalogOptions {
      try {
        return {
          cities: values(profiles.map((p) => p.city)),
          categories: values(profiles.flatMap((p) => p.categories)),
          eventFormats: values(profiles.flatMap((p) => p.eventFormats)),
          languages: values(profiles.flatMap((p) => p.languages)),
          dateRange: { ...CALENDAR_RANGE },
        };
      } catch {
        throw new RecommendationServiceError("Не удалось загрузить справочники каталога.");
      }
    },
    async recommend(input: SmartRecommendationRequest): Promise<RecommendationResponse> {
      try {
        const request = validateRequest(input);
        const analysis = analyzeMatches(profiles, request);
        return {
          status: !analysis.candidates.length ? "category_absent" : !analysis.eligible.length ? "no_match" : "matched",
          cards: analysis.eligible.slice(0, 3).map((profile) => ({
            id: profile.id,
            name: profile.name,
            category: profile.categories.find((c) => normalizeLabel(c) === normalizeLabel(request.category))!,
            city: profile.city,
            priceFromKzt: profile.priceFromKzt,
            explanation: explainMatch(profile, request),
            availability: "not_busy_in_dataset",
            synthetic: profile.synthetic,
            cityImputed: profile.cityImputed,
            priceImputed: profile.priceImputed,
            ...(request.preferences ? {
              evidence: matchPreferences(profile, request.preferences),
              unmatchedPreferences: requestedThemes(request.preferences).filter((theme) =>
                !matchPreferences(profile, request.preferences).some((e) => e.id === theme.id)).map((theme) => theme.label),
            } : {}),
          })),
          summary: explainSummary(analysis, request),
          ...(request.preferences ? { preferenceSummary: summarizePreferences(request.preferences,
            analysis.eligible.filter((p) => matchPreferences(p, request.preferences).length > 0).length) } : {}),
          ...(!analysis.eligible.length && analysis.candidates.length ? { alternatives: suggestPlanB(profiles, request) } : {}),
        };
      } catch (error) {
        if (error instanceof RequestValidationError || error instanceof RecommendationServiceError) throw error;
        throw new RecommendationServiceError();
      }
    },
  };
}
