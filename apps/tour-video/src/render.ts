import type { Focus } from './manifest.ts';
import type { SceneKind } from './script.ts';
import { leadSeconds } from './timeline.ts';

// ffmpeg arguments for one scene: a still that slowly zooms (toward its highlight, if any) while
// its narration plays, faded in and out. Built as plain strings so they can be tested.

const fps = 30;
const width = 1920;
const height = 1080;
/** Laptop frames are 1920 × 1200 (16:10); a video frame shows a 1920 × 1080 window of it. */
const desktopHeight = 1200;
const fadeSeconds = 0.4;
/** The brand's dark background, behind phone screens. */
const background = '0x0e131d';

/** Where the 16:9 window starts on a laptop frame: centred on the highlight, if there is one. */
export function cropTop(focus: Focus | null): number {
  if (focus === null) return 0;
  const centred = Math.round(focus.y + focus.height / 2 - height / 2);
  return Math.min(desktopHeight - height, Math.max(0, centred));
}

const zoomAmount = (kind: SceneKind, focus: Focus | null): number => {
  if (kind === 'card') return 0.03;
  return focus === null ? 0.06 : 0.16;
};

export interface SceneInput {
  readonly image: string;
  readonly audio: string;
  readonly kind: SceneKind;
  readonly focus: Focus | null;
  readonly seconds: number;
  readonly out: string;
}

export function sceneArgs(scene: SceneInput): string[] {
  const frames = Math.round(scene.seconds * fps);
  const top = cropTop(scene.focus);
  const frame = {
    desktop: `crop=${String(width)}:${String(height)}:0:${String(top)}`,
    phone: `scale=-2:1000,pad=${String(width)}:${String(height)}:(ow-iw)/2:(oh-ih)/2:color=${background}`,
    card: null,
  }[scene.kind];
  // Upscaling first keeps zoompan's steps smooth instead of jittery.
  const upscale = `scale=${String(width * 2)}:${String(height * 2)}`;
  const focus = scene.kind === 'desktop' ? scene.focus : null;
  const centre =
    focus === null
      ? { x: 'iw/2', y: 'ih/2' }
      : {
          x: String(Math.round((focus.x + focus.width / 2) * 2)),
          y: String(Math.round((focus.y - top + focus.height / 2) * 2)),
        };
  const zoom = [
    `zoompan=z='1+${String(zoomAmount(scene.kind, scene.focus))}*on/${String(frames)}'`,
    `x='max(0,min(iw-iw/zoom,${centre.x}-iw/zoom/2))'`,
    `y='max(0,min(ih-ih/zoom,${centre.y}-ih/zoom/2))'`,
    `d=${String(frames)}`,
    `s=${String(width)}x${String(height)}`,
    `fps=${String(fps)}`,
  ].join(':');
  const fadeOut = (scene.seconds - fadeSeconds).toFixed(1).replace(/\.0$/u, '');
  const video = [
    ...(frame === null ? [] : [frame]),
    upscale,
    zoom,
    `fade=t=in:st=0:d=${String(fadeSeconds)}`,
    `fade=t=out:st=${fadeOut}:d=${String(fadeSeconds)}`,
    'format=yuv420p',
  ].join(',');
  const audio = [
    `adelay=${String(leadSeconds * 1000)}:all=1`,
    'apad',
    `atrim=0:${String(scene.seconds)}`,
  ].join(',');
  return [
    '-y',
    '-loop',
    '1',
    '-i',
    scene.image,
    '-i',
    scene.audio,
    '-filter_complex',
    `[0:v]${video}[v];[1:a]${audio}[a]`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-t',
    String(scene.seconds),
    '-r',
    String(fps),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '44100',
    '-ac',
    '2',
    scene.out,
  ];
}

/** ffmpeg's concat list, quoting each path for its parser. */
export const concatList = (clips: readonly string[]): string =>
  clips.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'\n`).join('');
