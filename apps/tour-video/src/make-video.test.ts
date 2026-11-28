import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { err, ok } from '@thp/domain';
import { makeVideo, type Files, type Media, type Voice } from './make-video.ts';
import type { VideoPlan } from './script.ts';

const plan: VideoPlan = {
  id: 'chapter-live',
  title: 'TeacherHubPro: Live classroom games',
  description: 'Play together.',
  scenes: [
    { image: 'cards/en/chapter-live.png', kind: 'card', focus: null, narration: 'Live games.' },
    {
      image: 'frames/en/liveLobby.png',
      kind: 'desktop',
      focus: null,
      narration: 'Start a live game. Students join with a PIN.',
    },
  ],
};

class FakeMedia implements Media {
  readonly runs: (readonly string[])[] = [];
  constructor(private readonly audioSeconds = 2) {}
  seconds() {
    return Promise.resolve(this.audioSeconds);
  }
  run(args: readonly string[]) {
    this.runs.push(args);
    return Promise.resolve();
  }
}

class MemoryFiles implements Files {
  readonly written = new Map<string, string>();
  write(path: string, text: string) {
    this.written.set(path, text);
    return Promise.resolve();
  }
}

const voice: Voice = { speak: (text) => Promise.resolve(ok(`voice/${String(text.length)}.mp3`)) };

const deps = (media = new FakeMedia(), paced = false) => ({
  voice,
  media,
  files: new MemoryFiles(),
  framesDir: 'shots',
  outDir: 'out',
  paced,
});

describe('makeVideo', () => {
  it('renders each scene from its frame and narration, then joins them into one file', async () => {
    const d = deps();
    const result = await makeVideo(d, plan, 'en');

    const media = d.media;
    expect(media.runs).toHaveLength(3);
    expect(media.runs[0]).toContain(join('shots', 'cards/en/chapter-live.png'));
    expect(media.runs[1]).toContain('voice/44.mp3');
    expect(media.runs[2]).toEqual(
      expect.arrayContaining(['concat', join('out', 'en', 'chapter-live.mp4')]),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'chapter-live',
        title: plan.title,
        file: join('out', 'en', 'chapter-live.mp4'),
        captions: join('out', 'en', 'chapter-live.srt'),
        seconds: 6.2,
      },
    });
  });

  it('writes captions that follow each scene’s start', async () => {
    const d = deps();
    await makeVideo(d, plan, 'en');
    const srt = d.files.written.get(join('out', 'en', 'chapter-live.srt')) ?? '';
    expect(srt).toContain('00:00:00,300 --> 00:00:02,300\nLive games.');
    expect(srt).toContain('00:00:03,400 --> ');
    expect(srt).toContain('Students join with a PIN.');
  });

  it('holds scenes as long as their words take to say when the voice is a silent stand-in', async () => {
    const result = await makeVideo(deps(new FakeMedia(0.25), true), plan, 'en');
    // "Live games." (2 words) holds the 3-second minimum; the second line (9 words) takes 3.6 s.
    expect(result.ok && result.value.seconds).toBeCloseTo(3 + 0.3 + 3.6 + 0.8);
  });

  it('stops with the scene whose narration failed', async () => {
    const failing: Voice = { speak: () => Promise.resolve(err({ code: 'rate_limited' })) };
    const result = await makeVideo({ ...deps(), voice: failing }, plan, 'en');
    expect(result).toEqual({
      ok: false,
      error: { code: 'voice_failed', scene: 0, reason: 'rate_limited' },
    });
  });
});
