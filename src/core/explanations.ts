import type { RecommendationRequest } from "../shared/contracts";
import { normalizeLabel, type Contractor } from "./model";
import { REJECTION_ORDER, type MatchAnalysis, type RejectionReason } from "./matching";

export function formatKzt(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, " ") + " ₸";
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

const formatTerms: Record<string, RegExp> = {
  "свадьба": /свад|wedding/iu,
  "той": /той|тоя|тоев|националь|казах/iu,
  "корпоратив": /корпоратив|бизнес|делов|компани/iu,
  "конференция": /конференц|форум|делов|бизнес/iu,
  "юбилей": /юбиле/iu,
  "день рождения": /дн[ея] рождения|день рождения|семейн|именин/iu,
};

/** Deterministic source excerpt selection, NOT an LLM or verified quality claim. */
export function selectDescriptionEvidence(description: string, eventFormat: string): string {
  const terms = formatTerms[normalizeLabel(eventFormat)];
  const marketing = /^привет|^всем привет|^здравств|меня зовут|топ.?\d|лучши|наград|премия|премии|премию|премией|финалист|идеаль|отличн|незабыва|духовн|свяж|обаятельн|роскош|безупреч|№1/iu;
  const parts = description.split(/(?<=[.!?])\s+|\n+|[•●]/u).map((text) => text.trim())
    .filter((text) => Boolean(text) && !marketing.test(text));
  const scored = parts.map((text, index) => ({
    text, index,
    score: (terms?.test(text) ? 2 : 0) +
      (/стиль|специализ|снима|съ[её]м|оформ|освещ|интерактив|террас|цветоч/iu.test(text) ? 2 : 0) +
      (/репертуар|скрипк|саксофон|welcome|подиум|неон|магнит|вместим|репортаж|жанр|фотожурнал|живые кадры|без долг|развлечения и танцы|песн|стиль ведения|веду как|аранжиров|панорам|ресторан|язык|цветами|букет|музыкальный состав|расширенный состав/iu.test(text) ? 4 : 0) +
      (text.length >= 25 && text.length <= 180 ? 1 : 0),
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored[0] && scored[0].score > 1 ? scored[0].text : "";
  if (selected.length <= 180) return selected.replace(/[.!?]+$/u, "");
  const end = selected.lastIndexOf(" ", 180);
  return selected.slice(0, end > 90 ? end : 180).trimEnd();
}

export function explainMatch(profile: Contractor, request: RecommendationRequest): string {
  const eventFormat = profile.eventFormats.find((f) => normalizeLabel(f) === normalizeLabel(request.eventFormat))!;
  const facts = [
    `В профиле указан формат «${eventFormat}»`,
    `цена от ${formatKzt(profile.priceFromKzt)} при бюджете ${formatKzt(request.budgetKzt)}`,
  ];
  const evidence = selectDescriptionEvidence(profile.description, request.eventFormat);
  if (request.language !== undefined) {
    const requestedLanguage = request.language;
    const language = profile.languages.find((l) => normalizeLabel(l) === normalizeLabel(requestedLanguage))!;
    facts.push(`язык работы — ${language}`);
  }
  if (request.durationHours !== undefined) {
    facts.push(profile.maxHours === null
      ? "ограничение часов присутствия неприменимо"
      : `до ${profile.maxHours} ч на площадке при запросе ${request.durationHours} ч`);
  }
  // If the description has no informative excerpt, prefer concrete catalog fields
  // to promotional text. Do not invent a differentiating feature.
  if (!evidence) {
    if (request.language === undefined) facts.push(`языки работы — ${profile.languages.join(", ")}`);
    if (request.durationHours === undefined) facts.push(profile.maxHours === null
      ? "ограничение часов присутствия неприменимо" : `до ${profile.maxHours} ч на площадке`);
  }
  facts.push(`по календарю не занят ${formatDate(request.date)}`);
  return `${facts.join("; ")}.${evidence ? ` Фрагмент описания профиля: «${evidence}».` : ""}`;
}

const rejectionLabels: Record<RejectionReason, string> = {
  busy: "заняты на выбранную дату",
  budget: "начальная цена выше бюджета",
  format: "не берут выбранный формат",
  language: "не указан нужный язык",
  duration: "недостаточная длительность присутствия",
};

export function explainSummary(analysis: MatchAnalysis, request: RecommendationRequest): string {
  const total = analysis.candidates.length;
  if (!total) return `В каталоге города «${request.city}» нет профилей категории «${request.category}».`;
  const count = analysis.eligible.length;
  const result = count === 0
    ? `Профилей категории «${request.category}» в городе «${request.city}» — ${total}; ни один не проходит все условия на ${formatDate(request.date)}.`
    : `Подходящих профилей: ${count} из ${total} в этой категории и городе; показано ${Math.min(3, count)}.`;
  const scarcity = count > 0 && count < 3
    ? (total < 3
      ? ` Профилей выбранной категории в каталоге этого города — всего ${total}.`
      : " Остальные профили не проходят условия запроса.")
    : "";
  const reasons = REJECTION_ORDER.filter((reason) => analysis.exclusions[reason] > 0)
    .map((reason) => `${rejectionLabels[reason]} — ${analysis.exclusions[reason]}`);
  const rejected = reasons.length
    ? ` Исключены (для каждого профиля указана первая причина): ${reasons.join("; ")}.`
    : "";
  const ordering = count > 1 ? " Порядок — по начальной цене, при равенстве по id; это не рейтинг качества." : "";
  const pricing = count > 0 ? " Цена «от» не гарантирует итоговую стоимость." : "";
  return result + scarcity + rejected + ordering + pricing;
}
