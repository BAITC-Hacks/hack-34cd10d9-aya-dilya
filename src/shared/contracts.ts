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

/** Extends the MVP request without changing the existing form field mapping. */
export interface SmartRecommendationRequest extends RecommendationRequest {
  /** Soft preferences: affect order only, never relax the required filters. */
  preferences?: string;
}

export interface MatchEvidence {
  id: string;
  label: string;
  quote: string;
  source: "description";
}

export interface PlanBOption {
  id: string;
  kind: "budget" | "date";
  title: string;
  description: string;
  request: SmartRecommendationRequest;
  candidateCount: number;
  candidateNames: string[];
  budgetIncreaseKzt?: number;
  budgetIncreasePercent?: number;
  dateOffsetDays?: number;
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
  evidence?: MatchEvidence[];
  unmatchedPreferences?: string[];
  /** Present only when a server-generated explanation passes validation. */
  aiEvidenceIds?: string[];
  aiEvidence?: { label: string; text: string }[];
}

export type RecommendationStatus = "matched" | "category_absent" | "no_match";

export interface RecommendationResponse {
  status: RecommendationStatus;
  /** Service guarantees 0..3 unique cards. matched always has 1..3. */
  cards: RecommendationCard[];
  /** Explains the outcome, including why fewer than three were found. */
  summary: string;
  alternatives?: PlanBOption[];
  preferenceSummary?: string;
  ai?: { mode: "rules" | "openai"; reason?: "not_configured" | "unavailable" | "invalid_response"; cached?: boolean };
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
  recommend(request: SmartRecommendationRequest): Promise<RecommendationResponse>;
}

export interface ValidationIssue {
  field: keyof SmartRecommendationRequest | "request";
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
