import { describe, expect, it } from 'vitest';
import { createTranslator, locales } from '@thp/i18n';
import {
  captionCues,
  captionFileLocale,
  captionHeaders,
  introCaptionsVtt,
  introParagraphs,
  introVideoSeconds,
  webVtt,
} from './video-captions.ts';

interface ParsedCue {
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

const seconds = (stamp: string) => {
  const [h = '0', m = '0', s = '0'] = stamp.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

/** The cues of a WebVTT file, read back the way a player would. */
function parse(vtt: string): ParsedCue[] {
  const [, ...blocks] = vtt.trim().split('\n\n');
  return blocks.map((block) => {
    const [timing = '', ...lines] = block.split('\n');
    const [start = '', end = ''] = timing.split(' --> ');
    return { start: seconds(start), end: seconds(end), lines };
  });
}

const unspaced = (text: string) => text.replace(/\s+/gu, '');

describe('the intro video captions', () => {
  it.each(locales)(
    'are a WebVTT file with ordered cues spanning the whole video (%s)',
    (locale) => {
      const vtt = introCaptionsVtt(locale);
      expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
      const cues = parse(vtt);
      expect(cues.length).toBeGreaterThanOrEqual(introParagraphs.length);
      expect(cues[0]?.start).toBe(0);
      expect(cues.at(-1)?.end).toBe(introVideoSeconds);
      cues.forEach((cue, index) => {
        expect(cue.end).toBeGreaterThan(cue.start);
        expect(cue.start).toBeGreaterThanOrEqual(cues[index - 1]?.end ?? 0);
        expect(cue.end).toBeLessThanOrEqual(introVideoSeconds);
      });
    },
  );

  it.each(locales)('show at most two short lines at a time (%s)', (locale) => {
    for (const cue of parse(introCaptionsVtt(locale))) {
      expect(cue.lines.length).toBeGreaterThanOrEqual(1);
      expect(cue.lines.length).toBeLessThanOrEqual(2);
      expect(cue.lines.every((line) => line.trim() !== '')).toBe(true);
    }
  });

  it.each(locales)('say the whole script in that language and nothing else (%s)', (locale) => {
    const t = createTranslator(locale);
    const script = introParagraphs.map((n) => t(`marketing.video.p${n}`)).join('');
    const captions = parse(introCaptionsVtt(locale))
      .flatMap((cue) => cue.lines)
      .join('');
    expect(unspaced(captions)).toBe(unspaced(script));
  });

  it('starts each paragraph when its scene starts', () => {
    const t = createTranslator('es');
    const cues = parse(introCaptionsVtt('es'));
    const second = cues.find((cue) => cue.lines.join(' ').startsWith('¿Planifica'));
    expect(t('marketing.video.p2').startsWith('¿Planifica')).toBe(true);
    expect(second?.start).toBe(5.5);
    const last = cues.find((cue) => cue.lines.join(' ').includes('teacherhubpro.com'));
    expect(last?.end).toBe(introVideoSeconds);
  });
});

describe('captionCues', () => {
  it('keeps a short paragraph as one cue for its whole window', () => {
    expect(captionCues('Meet the app.', 2, 4)).toEqual([
      { start: 2, end: 4, lines: ['Meet the app.'] },
    ]);
  });

  it('joins short sentences and splits a long one at a comma', () => {
    const cues = captionCues(
      'Planning next week? Just type one sentence. The Prep Agent drafts your lesson plans, slides, worksheets, a Friday quiz, and even a parent email.',
      5.5,
      16.5,
    );
    const texts = cues.map((cue) => cue.lines.join(' '));
    expect(texts[0]).toBe('Planning next week? Just type one sentence.');
    expect(texts.length).toBeGreaterThan(2);
    expect(texts.slice(1, -1).every((text) => text.endsWith(','))).toBe(true);
    expect(texts.every((text) => text.length <= 84)).toBe(true);
  });

  it('divides the window in proportion to each cue’s length', () => {
    const short = 'Short words here.';
    const long = 'And this sentence is longer, so it stays on screen for a lot longer.';
    const cues = captionCues(`${short} ${long} ${long}`, 0, 10);
    expect(cues).toHaveLength(3);
    const [first, second, third] = cues;
    expect(first?.end).toBeLessThan(10 / 3);
    expect(second?.start).toBe(first?.end);
    expect((second?.end ?? 0) - (second?.start ?? 0)).toBeCloseTo(
      (third?.end ?? 0) - (third?.start ?? 0),
      2,
    );
    expect(third?.end).toBe(10);
  });

  it('wraps a long cue onto two balanced lines', () => {
    const [cue] = captionCues(
      'Every weekly plan is aligned to Common Core standards, organized.',
      0,
      1,
    );
    expect(cue?.lines).toHaveLength(2);
    const [top = '', bottom = ''] = cue?.lines ?? [];
    expect(Math.abs(top.length - bottom.length)).toBeLessThan(15);
  });

  it('never starts a line with French punctuation', () => {
    const [cue] = captionCues(
      'Le centre de commande est là : les classes du jour et le reste.',
      0,
      1,
    );
    expect(cue?.lines.every((line) => !/^[:;!?»]/u.test(line))).toBe(true);
  });

  it('splits Chinese, which has no spaces, at its own punctuation', () => {
    const cues = captionCues(
      '用指挥中心开始每一天：今天的课程、待批改的作业、可能需要帮助的学生，以及接下来的课程。然后继续。',
      0,
      8,
    );
    const texts = cues.map((cue) => cue.lines.join(''));
    expect(texts.join('')).toBe(
      '用指挥中心开始每一天：今天的课程、待批改的作业、可能需要帮助的学生，以及接下来的课程。然后继续。',
    );
    for (const cue of cues) {
      expect(cue.lines.length).toBeLessThanOrEqual(2);
      expect(cue.lines.every((line) => line.length <= 21)).toBe(true);
    }
  });

  it('escapes the characters WebVTT reserves', () => {
    expect(introCaptionsVtt('en')).not.toContain('<');
    expect(webVtt([{ start: 0, end: 1.25, lines: ['Fish & chips <b>'] }])).toBe(
      'WEBVTT\n\n00:00:00.000 --> 00:00:01.250\nFish &amp; chips &lt;b&gt;\n',
    );
  });
});

describe('captionFileLocale', () => {
  it('reads the language from a caption file name', () => {
    expect(captionFileLocale('es.vtt')).toBe('es');
    expect(captionFileLocale('zh.vtt')).toBe('zh');
  });

  it('refuses unknown languages and other file names', () => {
    expect(captionFileLocale('xx.vtt')).toBeNull();
    expect(captionFileLocale('es')).toBeNull();
    expect(captionFileLocale('es.srt')).toBeNull();
    expect(captionFileLocale('')).toBeNull();
  });
});

describe('captionHeaders', () => {
  it('serves WebVTT text that browsers may cache', () => {
    expect(captionHeaders['Content-Type']).toBe('text/vtt; charset=utf-8');
    expect(captionHeaders['Cache-Control']).toMatch(/^public, max-age=\d+$/u);
  });
});
