import { createTranslator, isLocale, type Locale } from '@thp/i18n';

/**
 * The homepage intro video's narration, one catalog paragraph per scene, with each scene's time
 * on screen in seconds (measured from the video's scene changes; re-measure if the video changes).
 */
const introScript = [
  { paragraph: '1', start: 0, end: 5.5 },
  { paragraph: '2', start: 5.5, end: 16.5 },
  { paragraph: '3', start: 16.5, end: 25 },
  { paragraph: '4', start: 25, end: 33.5 },
  { paragraph: '5', start: 33.5, end: 42.5 },
  { paragraph: '6', start: 42.5, end: 49.5 },
  { paragraph: '7', start: 49.5, end: 57.5 },
  { paragraph: '8', start: 57.5, end: 67.5 },
  { paragraph: '9', start: 67.5, end: 77.5 },
] as const;

export const introParagraphs = introScript.map(({ paragraph }) => paragraph);
export const introVideoSeconds = 77.5;

export interface CaptionCue {
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

/** Two short lines per cue; Chinese characters take two columns, so half as many fit a line. */
const lineWidth = 42;
const wide = /[\p{Script=Han}，。、；：！？]/gu;
const width = (text: string) => text.length + (text.match(wide)?.length ?? 0);

// Split points, coarsest first. Each keeps its spaces with the piece before, so pieces rejoin
// exactly. Chinese has no spaces: its words end at punctuation or next to Latin text, and a run
// of characters too long for a line splits between any two of them.
const sentenceEnds = /(?<=[.!?]\s+)(?=\S)|(?<=[。！？])(?=\S)/u;
const clauseEnds = /(?<=[,;:]\s+)(?=\S)|(?<=[，；：、])(?=\S)/u;
const wordEnds =
  /(?<=\s)(?=\S)|(?<=[，。、；：！？])(?=\S)|(?<=[^\s\p{Script=Han}，。、；：！？])(?=\p{Script=Han})|(?<=\p{Script=Han})(?=[^\s\p{Script=Han}，。、；：！？])/u;
const characterEnds = /(?<=\p{Script=Han})(?=\p{Script=Han})/u;
const levels = [sentenceEnds, clauseEnds, wordEnds, characterEnds] as const;

const opensLine = /^[:;!?»。，、；：！？）]/u;
const endsClause = /[,;:.!?，；：、。！？]$/u;

/** Every place a cue could break into two lines, never right before a closing mark. */
function lineBreaks(text: string, split: RegExp) {
  const words = text.split(split);
  return words
    .slice(1)
    .map((_, index) => {
      const top = words
        .slice(0, index + 1)
        .join('')
        .trimEnd();
      const bottom = words
        .slice(index + 1)
        .join('')
        .trimStart();
      const widest = Math.max(width(top), width(bottom));
      // Best: both lines fit and the first ends a clause; then both fit; then the most even.
      const rank = (widest <= lineWidth ? 0 : 2) + (endsClause.test(top) ? 0 : 1);
      return { lines: [top, bottom], widest, rank };
    })
    .filter(({ lines: [top = '', bottom = ''] }) => !opensLine.test(bottom) && !top.endsWith('«'));
}

/**
 * One line, or two: after a clause when both lines fit there, else at the most even break.
 * Words stay whole; only a run of Chinese with no break at all splits between characters.
 */
function wrap(text: string): string[] {
  if (width(text) <= lineWidth) return [text];
  const words = lineBreaks(text, wordEnds);
  const [best] = (words.length > 0 ? words : lineBreaks(text, characterEnds)).sort(
    (a, b) => a.rank - b.rank || a.widest - b.widest,
  );
  return best?.lines ?? [text];
}

const fits = (text: string) => wrap(text.trim()).every((line) => width(line) <= lineWidth);

/** Joins neighbouring pieces while they still fit in one cue. */
function merge(pieces: readonly string[]): string[] {
  const merged: string[] = [];
  for (const piece of pieces) {
    const last = merged.at(-1);
    if (last !== undefined && fits(`${last}${piece}`)) {
      merged[merged.length - 1] = `${last}${piece}`;
    } else {
      merged.push(piece);
    }
  }
  return merged;
}

/** Breaks text at sentences, then clauses, then words, until every piece fits in one cue. */
function pieces(text: string, level = 0): string[] {
  const split = levels[level];
  if (split === undefined || fits(text)) return [text];
  return merge(text.split(split).flatMap((part) => pieces(part, level + 1)));
}

const roundMs = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** A paragraph as caption cues, sharing its window in proportion to each cue's length. */
export function captionCues(paragraph: string, start: number, end: number): CaptionCue[] {
  const texts = pieces(paragraph)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
  const total = texts.reduce((sum, text) => sum + text.length, 0);
  let done = 0;
  return texts.map((text, index) => {
    const from = roundMs(start + ((end - start) * done) / total);
    done += text.length;
    const to = index === texts.length - 1 ? end : roundMs(start + ((end - start) * done) / total);
    return { start: from, end: to, lines: wrap(text) };
  });
}

const timestamp = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(
    Math.floor(ms / 1000) % 60,
  )}.${pad(ms % 1000, 3)}`;
};

const escapeText = (line: string) =>
  line.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');

/** A WebVTT file of the cues. */
export function webVtt(cues: readonly CaptionCue[]): string {
  const blocks = cues.map(
    (cue) =>
      `${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.lines.map(escapeText).join('\n')}`,
  );
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

/** The intro video's captions in a language, from that language's catalog. */
export function introCaptionsVtt(locale: Locale): string {
  const t = createTranslator(locale);
  return webVtt(
    introScript.flatMap(({ paragraph, start, end }) =>
      captionCues(t(`marketing.video.p${paragraph}`), start, end),
    ),
  );
}

/** The language of a caption file name such as `es.vtt`, or null when it names none. */
export function captionFileLocale(file: string): Locale | null {
  const locale = /^([a-z]{2})\.vtt$/u.exec(file)?.[1];
  return isLocale(locale) ? locale : null;
}

/** Captions change only with a release, so browsers may keep them for an hour. */
export const captionHeaders = {
  'Content-Type': 'text/vtt; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
} as const;
