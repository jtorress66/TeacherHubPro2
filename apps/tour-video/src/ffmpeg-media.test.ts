import { describe, expect, it } from 'vitest';
import { durationOf } from './ffmpeg-media.ts';

describe('durationOf', () => {
  it('reads how long a file plays from ffmpeg’s report', () => {
    const report = `Input #0, mp3, from 'voice/a.mp3':\n  Duration: 00:01:05.23, start: 0.025057, bitrate: 160 kb/s`;
    expect(durationOf(report)).toBeCloseTo(65.23);
  });

  it('is null when the report names no duration', () => {
    expect(durationOf('voice/a.mp3: No such file or directory')).toBeNull();
  });
});
