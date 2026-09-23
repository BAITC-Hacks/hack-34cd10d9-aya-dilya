import catalog from "../data/catalog.json";
import type { CatalogOptions, RecommendationRequest, RecommendationResponse, RecommendationService } from "../shared/contracts";
import { createRecommendationService } from "./service";

let service: RecommendationService | undefined;
function getService(): RecommendationService {
  return service ??= createRecommendationService(catalog.profiles);
}

export function getCatalogOptions(): CatalogOptions {
  return getService().getCatalogOptions();
}

export async function recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
  return getService().recommend(request);
}

export const recommendationService: RecommendationService = { getCatalogOptions, recommend };
export { RecommendationServiceError, RequestValidationError } from "../shared/contracts";
export type {
  CatalogOptions, RecommendationCard, RecommendationRequest, RecommendationResponse,
  RecommendationService, RecommendationStatus, ValidationIssue,
} from "../shared/contracts";
