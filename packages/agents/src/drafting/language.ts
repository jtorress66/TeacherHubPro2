import type { Language } from '@thp/domain';

/** How each language is named to the model. */
export const languageNames: Readonly<Record<Language, string>> = {
  en: 'English',
  es: 'Spanish (español)',
  fr: 'French (français)',
  pt: 'Portuguese (português)',
  de: 'German (Deutsch)',
  it: 'Italian (italiano)',
  zh: 'Simplified Chinese (简体中文)',
};

// Common short words per language, written without accents (text is compared without them).
// Spanish and Portuguese share some ("que", "para"), so each list also has words the other lacks.
const stopWords: Readonly<Record<Exclude<Language, 'zh'>, readonly string[]>> = {
  en: ['the', 'and', 'of', 'to', 'students', 'with', 'their', 'what', 'is', 'are', 'which'],
  es: ['los', 'las', 'el', 'del', 'que', 'y', 'estudiantes', 'con', 'para', 'un', 'una', 'es'],
  fr: ['les', 'des', 'et', 'le', 'la', 'eleves', 'avec', 'pour', 'une', 'est', 'du', 'sont'],
  pt: ['os', 'as', 'do', 'da', 'que', 'e', 'alunos', 'com', 'para', 'um', 'uma', 'nao', 'sao'],
  de: ['die', 'der', 'und', 'das', 'mit', 'schuler', 'fur', 'ein', 'eine', 'ist', 'sind'],
  it: ['il', 'gli', 'della', 'che', 'e', 'studenti', 'con', 'per', 'sono', 'piu', 'lo'],
};

const withoutAccents = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The language whose common words appear most, with how many appeared (`hits`); mostly CJK text
 * counts as Chinese. With no hits, text such as single names or numbers shows no language.
 */
export function languageEvidence(text: string): { language: Language; hits: number } {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  const cjk = (letters.match(/\p{Script=Han}/gu) ?? []).length;
  if (letters.length > 0 && cjk / letters.length > 0.3) return { language: 'zh', hits: cjk };
  const words = withoutAccents(text).split(/[^\p{L}]+/u);
  let best: Language = 'en';
  let hits = 0;
  for (const [language, list] of Object.entries(stopWords) as [Language, readonly string[]][]) {
    const score = words.filter((word) => list.includes(word)).length;
    if (score > hits) {
      best = language;
      hits = score;
    }
  }
  return { language: best, hits };
}

/** The language the text is most likely in (English when nothing shows). */
export const detectLanguage = (text: string): Language => languageEvidence(text).language;
