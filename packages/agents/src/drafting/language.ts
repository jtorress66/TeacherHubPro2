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

const stopWords: Readonly<Record<Exclude<Language, 'zh'>, readonly string[]>> = {
  en: ['the', 'and', 'of', 'to', 'students', 'with', 'their', 'what'],
  es: ['los', 'las', 'el', 'del', 'que', 'y', 'estudiantes', 'con', 'para'],
  fr: ['les', 'des', 'et', 'le', 'la', 'élèves', 'avec', 'pour'],
  pt: ['os', 'as', 'do', 'da', 'que', 'e', 'alunos', 'com', 'para'],
  de: ['die', 'der', 'und', 'das', 'mit', 'schüler', 'für', 'ein'],
  it: ['il', 'gli', 'della', 'che', 'e', 'studenti', 'con', 'per'],
};

/** The language whose common words appear most; mostly CJK text counts as Chinese. */
export function detectLanguage(text: string): Language {
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  const cjk = (letters.match(/\p{Script=Han}/gu) ?? []).length;
  if (letters.length > 0 && cjk / letters.length > 0.3) return 'zh';
  const words = text.toLowerCase().split(/[^\p{L}]+/u);
  let best: Language = 'en';
  let bestScore = -1;
  for (const [language, list] of Object.entries(stopWords) as [Language, readonly string[]][]) {
    const score = words.filter((word) => list.includes(word)).length;
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  return best;
}
