import type { MatchEvidence } from "../shared/contracts";
import type { Contractor } from "./model";

interface Theme { id: string; label: string; query: RegExp; source: RegExp }
// Evidence must describe actual activities, not anonymized brand names.
// Latin IT has Unicode boundaries: it must not match Konpeito or credits.
const themes: Theme[] = [
  { id: "technology", label: "Технологичная тематика", query: /(?<![\p{L}\p{N}])it(?![\p{L}\p{N}])|айти|технол|техно|гик|geek|digital|цифров/iu,
    source: /технологическ\p{L}*\s+форум\p{L}*|технологии\s+и\s+искусство|цифров\p{L}*\s+(?:событи|мероприят)\p{L}*|(?<![\p{L}\p{N}])IT[ -](?:корпоратив|форум|компани)\p{L}*/iu },
  { id: "intimate", label: "Камерная атмосфера", query: /камерн|небольш|уютн|лампов/iu, source: /камерн\p{L}*|лампов\p{L}*/iu },
  { id: "tact", label: "Тактичная подача", query: /интеллигент|тактич|ненавязчив|без\s+(?:пошл\p{L}*\s+)?конкурс\p{L}*/iu,
    source: /интеллигент\p{L}*|ненавязчив\p{L}*|тактич\p{L}*|не\s+шучу\s+над\s+человеком/iu },
  { id: "improv", label: "Импровизация", query: /импровиз|интерактив|стендап|stand[ -]?up/iu, source: /импровиз\p{L}*|интерактив\p{L}*|stand[ -]?up/iu },
  { id: "reportage", label: "Репортажная съёмка", query: /репортаж|документальн|жив\p{L}*\s+(?:кадр|эмоци)/iu,
    source: /репортаж\p{L}*|фотожурнал\p{L}*|жив\p{L}*\s+(?:кадр|эмоци)\p{L}*/iu },
  { id: "jazz", label: "Джаз", query: /джаз|jazz/iu, source: /джаз\p{L}*|jazz/iu },
  { id: "live", label: "Живая музыка", query: /жив\p{L}*\s+музык|скрипк|саксофон|live\s+music/iu,
    source: /жив\p{L}*\s+(?:музык|барабан)\p{L}*|скрипк\p{L}*|саксофон\p{L}*/iu },
  { id: "welcome", label: "Welcome-зона", query: /welcome|велком|встреч\p{L}*\s+гост/iu, source: /welcome[ -]?\p{L}*|встреч\p{L}*\s+гост\p{L}*/iu },
  { id: "personal", label: "Индивидуальное оформление", query: /индивидуальн|персональн|брендирован|логотип|палитр/iu,
    source: /индивидуальн\p{L}*\s+(?:дизайн|концепц)\p{L}*|логотип\p{L}*|цветов\p{L}*\s+палитр\p{L}*|брендирован\p{L}*/iu },
  { id: "national", label: "Национальные традиции", query: /национальн|традици|этно/iu, source: /национальн\p{L}*|традици\p{L}*|этно[ -]?\p{L}*/iu },
];

function affirmativeMatch(text: string, pattern: RegExp): RegExpExecArray | null {
  const globalPattern = new RegExp(pattern.source, pattern.flags + "g");
  for (const match of text.matchAll(globalPattern)) {
    const prefix = text.slice(Math.max(0, match.index! - 35), match.index);
    if (/(?<!\p{L})(?:без|не|никаких|исключить)\s+(?:\p{L}+\s+){0,3}$/iu.test(prefix)) continue;
    return match;
  }
  return null;
}

export function requestedThemes(preferences = ""): Theme[] {
  return themes.filter((theme) => affirmativeMatch(preferences, theme.query));
}

function excerpt(text: string, index: number, length: number): string {
  const before = text.slice(0, index);
  const boundary = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  let start = boundary < 0 ? 0 : boundary + (text[boundary] === "\n" ? 1 : 2);
  if (index - start > 100) start = Math.max(start, text.lastIndexOf(" ", index - 80) + 1);
  const after = text.slice(index + length).search(/[.!?](?:\s|$)|\n/u);
  const sentenceEnd = after < 0 ? text.length : index + length + after + 1;
  let end = Math.min(sentenceEnd, start + 240);
  if (end < sentenceEnd) end = Math.max(index + length, text.lastIndexOf(" ", end));
  return text.slice(start, end).trim();
}

export function matchPreferences(profile: Contractor, preferences = ""): MatchEvidence[] {
  return requestedThemes(preferences).flatMap((theme) => {
    const match = affirmativeMatch(profile.description, theme.source);
    return match ? [{ id: theme.id, label: theme.label, quote: excerpt(profile.description, match.index!, match[0].length), source: "description" as const }] : [];
  });
}

export function summarizePreferences(preferences: string, matches: number): string {
  const labels = requestedThemes(preferences).map((t) => t.label);
  if (!labels.length) return "Не распознали тему пожеланий. Сохранили порядок по начальной цене; попробуйте уточнить пожелания.";
  const text = `Распознаны темы: ${labels.join(", ")}. `;
  return text + (matches
    ? "Сначала показаны совпадения, для которых есть цитаты из профилей. Пожелания не отменяют обязательные условия."
    : "У подходящих кандидатов нет подтверждающих фрагментов по этим темам; порядок — по начальной цене.");
}
