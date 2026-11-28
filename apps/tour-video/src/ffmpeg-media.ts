import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Media } from './make-video.ts';

/** Reads "Duration: 00:00:05.23" from ffmpeg's report on a file, in seconds. */
export function durationOf(report: string): number | null {
  const match = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/u.exec(report);
  if (match === null) return null;
  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

const exec = (binary: string, args: readonly string[]) =>
  new Promise<{ readonly stdout: string; readonly stderr: string }>((resolve, reject) => {
    execFile(binary, args, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg failed: ${stderr.slice(-2000)}`));
      else resolve({ stdout, stderr });
    });
  });

/** ffmpeg on this machine (the `ffmpeg-static` binary), making each output's folder first. */
export class FfmpegMedia implements Media {
  constructor(private readonly binary: string) {}

  async run(args: readonly string[]): Promise<void> {
    const out = args.at(-1);
    if (out !== undefined) await mkdir(dirname(out), { recursive: true });
    await exec(this.binary, ['-hide_banner', '-loglevel', 'error', ...args]);
  }

  async seconds(audio: string): Promise<number> {
    const { stderr } = await exec(this.binary, ['-hide_banner', '-i', audio, '-f', 'null', '-']);
    const seconds = durationOf(stderr);
    if (seconds === null) throw new Error(`No duration in ffmpeg's report on ${audio}.`);
    return seconds;
  }
}
