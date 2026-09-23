import { recommendationService } from "../core/index";
import type { SmartRecommendationRequest, RecommendationResponse, RecommendationService } from "../shared/contracts";

import { validateRequest } from "../core/validate-request";
import { RequestValidationError, RecommendationServiceError } from "../shared/contracts";

export function createHttpAdapter(fetcher: typeof fetch = fetch, timeoutMs = 8500): RecommendationService {
  return {
    getCatalogOptions: recommendationService.getCatalogOptions,
    async recommend(input) {
      const request = validateRequest(input);
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, timeoutMs);
        });
        const response = await Promise.race([fetcher("/api/recommend", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request), signal: controller.signal,
        }).then(async response => ({ status: response.status, ok: response.ok, body: await response.json() })), timeout]);
        if (response.status === 400) {
          if (response.body.code === "INVALID_REQUEST" && Array.isArray(response.body.issues)) {
            throw new RequestValidationError(response.body.issues);
          }
          throw new RecommendationServiceError("Не удалось передать параметры подбора.");
        }
        if (!response.ok) throw new Error("API unavailable");
        if (!response.body || !["matched", "no_match", "category_absent"].includes(response.body.status)
          || !Array.isArray(response.body.cards) || typeof response.body.summary !== "string") throw new Error("Invalid API response");
        return response.body as RecommendationResponse;
      } catch (error) {
        if (error instanceof RequestValidationError || error instanceof RecommendationServiceError) throw error;
        const result = await recommendationService.recommend(request);
        return { ...result, ai: { mode: "rules", reason: "unavailable" } };
      } finally { clearTimeout(timer); }
    },
  };
}

export const serviceAdapter = createHttpAdapter();

/** Only the most recent request may publish success or failure. */
export function createLatestRequestRunner(service: RecommendationService) {
  let version = 0;
  return {
    invalidate() { version += 1; },
    async run(
      request: SmartRecommendationRequest,
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
