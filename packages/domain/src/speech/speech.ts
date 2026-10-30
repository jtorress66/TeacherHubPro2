import { isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { maxGenerationLength } from '../assistant/generation.ts';

/** Text-to-speech services take a few thousand characters per call. */
export const maxSpeechPartLength = 4000;
export const maxSpeechTextLength = maxGenerationLength;

/** Text to read aloud, already split into parts the voice service accepts. */
export interface SpeechRequest {
  readonly language: Language;
  readonly parts: readonly string[];
}

const tableRule = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const blankCell = /^_+$/;

function speakableLine(line: string): string | null {
  if (tableRule.test(line)) return null;
  let text = line
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2');
  if (text.trim().startsWith('|')) {
    const cells = text
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell !== '' && !blankCell.test(cell));
    text = cells.join(', ');
  }
  return text.trim();
}

/** Markdown as it should sound: no marks, table rules or fill-in blanks. */
export function speakableText(markdown: string): string {
  return markdown
    .split('\n')
    .map(speakableLine)
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Splits at the last break of the given kind before the limit, or returns null. */
function cutAt(text: string, pattern: RegExp): number | null {
  let cut: number | null = null;
  for (const match of text.slice(0, maxSpeechPartLength).matchAll(pattern)) {
    cut = match.index + match[0].length;
  }
  return cut !== null && cut > 0 ? cut : null;
}

/** Text split into parts within the service limit: at paragraphs, then sentences, then spaces. */
export function speechParts(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > maxSpeechPartLength) {
    const cut =
      cutAt(rest, /\n\s*\n/g) ??
      cutAt(rest, /[.!?。！？]\s+/g) ??
      cutAt(rest, /\s+/g) ??
      maxSpeechPartLength;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest !== '') parts.push(rest);
  return parts;
}

export function createSpeechRequest(input: {
  readonly text: string;
  readonly language: string;
}): Result<SpeechRequest, ValidationError> {
  if (input.text.length > maxSpeechTextLength) return invalid('text', 'too_long');
  const parts = speechParts(speakableText(input.text));
  if (parts.length === 0) return invalid('text', 'required');
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  return ok({ language: input.language, parts });
}
