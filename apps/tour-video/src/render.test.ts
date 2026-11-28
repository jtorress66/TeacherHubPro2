import { describe, expect, it } from 'vitest';
import { concatList, cropTop, sceneArgs } from './render.ts';

const base = {
  image: 'frames/en/liveLobby.png',
  audio: 'voice/abc.mp3',
  seconds: 5,
  out: 'clips/1.mp4',
};

const filterOf = (args: readonly string[]) => args[args.indexOf('-filter_complex') + 1] ?? '';

describe('cropTop', () => {
  it('keeps a laptop screen’s top when nothing is highlighted', () => {
    expect(cropTop(null)).toBe(0);
  });

  it('moves the 16:9 window down to keep a low highlight in view, never past the bottom', () => {
    expect(cropTop({ x: 0, y: 900, width: 100, height: 200 })).toBe(120);
    expect(cropTop({ x: 0, y: 100, width: 100, height: 50 })).toBe(0);
  });
});

describe('sceneArgs', () => {
  it('turns a still and its narration into a 1080p clip of the scene’s length', () => {
    const args = sceneArgs({ ...base, kind: 'desktop', focus: null });
    expect(args).toEqual(
      expect.arrayContaining([
        '-loop',
        '1',
        '-i',
        base.image,
        '-i',
        base.audio,
        '-t',
        '5',
        base.out,
      ]),
    );
    expect(args).toEqual(expect.arrayContaining(['-c:v', 'libx264', '-pix_fmt', 'yuv420p']));
    const filter = filterOf(args);
    expect(filter).toContain('crop=1920:1080:0:0');
    expect(filter).toContain('zoompan=');
    expect(filter).toContain('s=1920x1080');
    expect(filter).toContain('fade=t=in');
    expect(filter).toContain('fade=t=out:st=4.6');
    expect(filter).toContain('adelay=300');
  });

  it('zooms further toward a highlighted area than toward the middle', () => {
    const plain = filterOf(sceneArgs({ ...base, kind: 'desktop', focus: null }));
    const aimed = filterOf(
      sceneArgs({ ...base, kind: 'desktop', focus: { x: 1200, y: 300, width: 400, height: 100 } }),
    );
    expect(plain).toContain('1+0.06*on/150');
    expect(aimed).toContain('1+0.16*on/150');
    // The window centres on the highlight (x 1400, y 350), doubled for the smoother upscale.
    expect(aimed).toContain('2800-iw/zoom/2');
    expect(aimed).toContain('700-ih/zoom/2');
  });

  it('stands a phone screen upright in the middle of the brand background', () => {
    const filter = filterOf(sceneArgs({ ...base, kind: 'phone', focus: null }));
    expect(filter).toContain('scale=-2:1000');
    expect(filter).toContain('pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0e131d');
  });

  it('shows a title card whole, with only a gentle zoom', () => {
    const filter = filterOf(sceneArgs({ ...base, kind: 'card', focus: null }));
    expect(filter).not.toContain('crop=');
    expect(filter).toContain('1+0.03*on/150');
  });
});

describe('concatList', () => {
  it('lists clips for joining, quoting paths safely', () => {
    expect(concatList(['clips/1.mp4', "clips/it's.mp4"])).toBe(
      "file 'clips/1.mp4'\nfile 'clips/it'\\''s.mp4'\n",
    );
  });
});
