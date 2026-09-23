/** Shared UI/service contract. Amounts are KZT per contractor/event. */
export interface RecommendationRequest {
  city: string;
  /** Calendar date YYYY-MM-DD, without a time or time zone. */
  date: string;
  eventFormat: string;
  category: string;
  budgetKzt: number;
  language?: string;
  durationHours?: number;
}

export interface RecommendationCard {
  id: string;
  name: string;
  /** The requested category, even when the profile has several. */
  category: string;
  city: string;
  /** Starting price, not a guaranteed quote. */
  priceFromKzt: number;
  explanation: string;
  availability: "not_busy_in_dataset";
  synthetic: boolean;
  cityImputed: boolean;
  priceImputed: boolean;
}

export type RecommendationStatus = "matched" | "category_absent" | "no_match";

export interface RecommendationResponse {
  status: RecommendationStatus;
  /** Service guarantees 0..3 unique cards. matched always has 1..3. */
  cards: RecommendationCard[];
  /** Explains the outcome, including why fewer than three were found. */
  summary: string;
}

export interface CatalogOptions {
  cities: string[];
  categories: string[];
  eventFormats: string[];
  languages: string[];
  /** Inclusive date-only bounds; not inferred from busy dates. */
  dateRange: { min: string; max: string };
}

export interface RecommendationService {
  /** Synchronous: catalog metadata is loaded with the application. */
  getCatalogOptions(): CatalogOptions;
  /** Rejects on invalid input/technical failure; empty matches resolve normally. */
  recommend(request: RecommendationRequest): Promise<RecommendationResponse>;
}

export interface ValidationIssue {
  field: keyof RecommendationRequest | "request";
  message: string;
}

export class RequestValidationError extends Error {
  readonly code = "INVALID_REQUEST";
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "RequestValidationError";
  }
}

export class RecommendationServiceError extends Error {
  readonly code = "SERVICE_ERROR";
  constructor(message = "Не удалось выполнить подбор. Попробуйте ещё раз.") {
    super(message);
    this.name = "RecommendationServiceError";
  }
}
