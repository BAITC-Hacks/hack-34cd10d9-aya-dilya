import { recommendationService } from "../core/index";
import type { RecommendationRequest, RecommendationResponse, RecommendationService } from "../shared/contracts";

// The production adapter delegates unchanged requests to A's real local service.
export const serviceAdapter: RecommendationService = recommendationService;

/** Only the most recent request may publish success or failure. */
export function createLatestRequestRunner(service: RecommendationService) {
  let version = 0;
  return {
    invalidate() { version += 1; },
    async run(
      request: RecommendationRequest,
      onSuccess: (response: RecommendationResponse) => void,
      onError: (error: unknown) => void,
    ) {
      const current = ++version;
      try {
        const response = await service.recommend(request);
        if (current === version) onSuccess(response);
      } catch (error) {
        if (current === version) onError(error);
      }
    },
  };
}
