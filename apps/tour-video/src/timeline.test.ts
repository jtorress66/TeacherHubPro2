import { describe, expect, it } from 'vitest';
import { captionsFor, sceneSeconds, speakingSeconds, toSrt } from './timeline.ts';

describe('sceneSeconds', () => {
  it('holds each screen while its narration plays, with a short breath before and after', () => {
    expect(sceneSeconds(6)).toBeCloseTo(7.1);
  });

  it('never flashes a screen by too quickly', () => {
    expect(sceneSeconds(0.25)).toBe(3);
  });
});

describe('speakingSeconds', () => {
  it('estimates how long words take to say, for silent previews', () => {
    expect(speakingSeconds('one two three four five six seven eight nine ten', 'en')).toBeCloseTo(
      4,
    );
  });

  it('counts Chinese by characters, as it has no spaces between words', () => {
    expect(speakingSeconds('欢迎使用教学工作台', 'zh')).toBeCloseTo(9 / 4.5);
  });
});

describe('captions', () => {
  it('splits a scene’s narration into one caption per sentence, timed by length', () => {
    const cues = captionsFor([
      { narration: 'Short one. A much longer second sentence here.', start: 10, speech: 6 },
    ]);
    expect(cues.map((c) => c.text)).toEqual(['Short one.', 'A much longer second sentence here.']);
    expect(cues[0]?.start).toBeCloseTo(10.3);
    expect(cues[1]?.end).toBeCloseTo(16.3);
    expect(cues[0]?.end).toBeCloseTo(cues[1]?.start ?? 0);
    expect((cues[0]?.end ?? 0) - (cues[0]?.start ?? 0)).toBeLessThan(
      (cues[1]?.end ?? 0) - (cues[1]?.start ?? 0),
    );
  });

  it('does not split a web address or a number at its dot', () => {
    const cues = captionsFor([
      {
        narration: 'Water boils at 100.5 degrees. Try it at teacherhubpro.com.',
        start: 0,
        speech: 4,
      },
    ]);
    expect(cues.map((c) => c.text)).toEqual([
      'Water boils at 100.5 degrees.',
      'Try it at teacherhubpro.com.',
    ]);
  });

  it('splits Chinese at its own full stops', () => {
    const cues = captionsFor([{ narration: '第一句。第二句。', start: 0, speech: 2 }]);
    expect(cues.map((c) => c.text)).toEqual(['第一句。', '第二句。']);
  });

  it('writes SubRip captions that video sites accept', () => {
    expect(
      toSrt([
        { start: 0.3, end: 2.5, text: 'Hello.' },
        { start: 62.25, end: 3725.5, text: 'Bye.' },
      ]),
    ).toBe('1\n00:00:00,300 --> 00:00:02,500\nHello.\n\n2\n00:01:02,250 --> 01:02:05,500\nBye.\n');
  });
});
