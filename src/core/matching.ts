import type { SmartRecommendationRequest } from "../shared/contracts";
import { compareText, normalizeLabel, type Contractor } from "./model";
import { matchPreferences } from "./preferences";

export const REJECTION_ORDER = ["busy", "budget", "format", "language", "duration"] as const;
export type RejectionReason = typeof REJECTION_ORDER[number];
export interface Decision { profile: Contractor; reasons: RejectionReason[] }
export interface MatchAnalysis {
  candidates: Decision[];
  eligible: Contractor[];
  /** Each excluded profile appears exactly once in these counts. */
  exclusions: Record<RejectionReason, number>;
}

export function hasLabel(values: string[], requested: string): boolean {
  return values.some((value) => normalizeLabel(value) === normalizeLabel(requested));
}

/** No score claims: the cheapest qualifying starting price comes first. */
export function compareContractors(a: Contractor, b: Contractor): number {
  return a.priceFromKzt - b.priceFromKzt || compareText(a.id, b.id);
}

export function analyzeMatches(profiles: readonly Contractor[], request: SmartRecommendationRequest): MatchAnalysis {
  const exclusions: Record<RejectionReason, number> = { busy: 0, budget: 0, format: 0, language: 0, duration: 0 };
  const candidates: Decision[] = profiles
    .filter((p) => normalizeLabel(p.city) === normalizeLabel(request.city) && hasLabel(p.categories, request.category))
    .map((profile) => {
      const reasons: RejectionReason[] = [];
      if (profile.busyDates.includes(request.date)) reasons.push("busy");
      if (profile.priceFromKzt > request.budgetKzt) reasons.push("budget");
      if (!hasLabel(profile.eventFormats, request.eventFormat)) reasons.push("format");
      if (request.language !== undefined && !hasLabel(profile.languages, request.language)) reasons.push("language");
      if (request.durationHours !== undefined && profile.maxHours !== null && profile.maxHours < request.durationHours) {
        reasons.push("duration");
      }
      if (reasons.length) exclusions[reasons[0]]++;
      return { profile, reasons };
    });
  const scores = new Map(candidates.filter((c) => !c.reasons.length).map((c) =>
    [c.profile.id, request.preferences ? matchPreferences(c.profile, request.preferences).length : 0]));
  return {
    candidates,
    eligible: candidates.filter((c) => c.reasons.length === 0).map((c) => c.profile)
      .sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || compareContractors(a, b)),
    exclusions,
  };
}
