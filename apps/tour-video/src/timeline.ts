import type { Locale } from '@thp/i18n';

// How long each scene lasts and when each caption shows.

/** Quiet before the narrator starts, so a cut never clips the first word. */
export const leadSeconds = 0.3;
/** Time to take in the screen after the narrator stops. */
const tailSeconds = 0.8;
const shortestScene = 3;

export const sceneSeconds = (speechSeconds: number): number =>
  Math.max(shortestScene, leadSeconds + speechSeconds + tailSeconds);

/** A calm narrator's pace: words per second, or characters per second in Chinese. */
export function speakingSeconds(text: string, locale: Locale): number {
  if (locale === 'zh') {
    const characters = new Intl.Segmenter('zh', { granularity: 'grapheme' });
    return [...characters.segment(text.replace(/\s/gu, ''))].length / 4.5;
  }
  return text.split(/\s+/u).filter(Boolean).length / 2.5;
}

export interface Cue {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * Splits after a full stop, question or exclamation mark followed by a space (so "100.5" and
 * "teacherhubpro.com" stay whole), or after Chinese ones, which need no space.
 */
const sentences = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|(?<=[。！？])/u)
    .map((s) => s.trim())
    .filter(Boolean);

/** One caption per sentence, sharing the narration's time by the sentences' lengths. */
export function captionsFor(
  scenes: readonly {
    readonly narration: string;
    readonly start: number;
    readonly speech: number;
  }[],
): Cue[] {
  return scenes.flatMap((scene) => {
    const parts = sentences(scene.narration);
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    let at = scene.start + leadSeconds;
    return parts.map((text) => {
      const start = at;
      at += (scene.speech * text.length) / total;
      return { start, end: at, text };
    });
  });
}

const stamp = (seconds: number): string => {
  const ms = Math.round(seconds * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
};

/** SubRip (.srt), the caption format video sites accept on upload. */
export const toSrt = (cues: readonly Cue[]): string =>
  cues
    .map((cue, i) => `${String(i + 1)}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`)
    .join('\n');
