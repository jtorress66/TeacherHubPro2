import { join } from 'node:path';
import { err, ok, type Language, type Result } from '@thp/domain';
import type { TextToSpeechError } from '@thp/ports';
import { concatList, sceneArgs } from './render.ts';
import type { VideoPlan } from './script.ts';
import { captionsFor, sceneSeconds, speakingSeconds, toSrt } from './timeline.ts';

/** Speaks a line and returns the audio file's path. */
export interface Voice {
  speak(text: string, language: Language): Promise<Result<string, TextToSpeechError>>;
}

/** The ffmpeg work, behind a seam so the plan can be tested without making videos. */
export interface Media {
  /** How long an audio file plays. */
  seconds(audio: string): Promise<number>;
  /** Runs ffmpeg with these arguments. */
  run(args: readonly string[]): Promise<void>;
}

export interface Files {
  write(path: string, text: string): Promise<void>;
}

export interface VideoDeps {
  readonly voice: Voice;
  readonly media: Media;
  readonly files: Files;
  /** Where `pnpm tour:capture` wrote frames and cards. */
  readonly framesDir: string;
  readonly outDir: string;
  /**
   * With a silent stand-in voice, hold each scene as long as the line would take to say, so a
   * free preview has the real videos' rhythm.
   */
  readonly paced: boolean;
}

export interface MadeVideo {
  readonly id: string;
  readonly title: string;
  readonly file: string;
  readonly captions: string;
  readonly seconds: number;
}

export interface VideoProblem {
  readonly code: 'voice_failed';
  /** Which scene's line the voice service could not speak, counting from 0. */
  readonly scene: number;
  readonly reason: TextToSpeechError['code'];
}

/** Narrates, renders and joins one video's scenes, and writes its captions. */
export async function makeVideo(
  deps: VideoDeps,
  plan: VideoPlan,
  language: Language,
): Promise<Result<MadeVideo, VideoProblem>> {
  const work = join(deps.outDir, 'work', language, plan.id);
  const clips: string[] = [];
  const timed: { narration: string; start: number; speech: number }[] = [];
  let at = 0;

  for (const [index, scene] of plan.scenes.entries()) {
    const audio = await deps.voice.speak(scene.narration, language);
    if (!audio.ok) return err({ code: 'voice_failed', scene: index, reason: audio.error.code });
    const heard = await deps.media.seconds(audio.value);
    const speech = deps.paced ? Math.max(heard, speakingSeconds(scene.narration, language)) : heard;
    const seconds = Number(sceneSeconds(speech).toFixed(2));
    const clip = join(work, `${String(index).padStart(2, '0')}.mp4`);
    await deps.media.run(
      sceneArgs({
        image: join(deps.framesDir, scene.image),
        audio: audio.value,
        kind: scene.kind,
        focus: scene.focus,
        seconds,
        out: clip,
      }),
    );
    clips.push(clip);
    timed.push({ narration: scene.narration, start: at, speech });
    at += seconds;
  }

  const list = join(work, 'clips.txt');
  await deps.files.write(list, concatList(clips));
  const file = join(deps.outDir, language, `${plan.id}.mp4`);
  // The picture is copied as it is; the voice is evened to YouTube's loudness (-14 LUFS).
  await deps.media.run([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '44100',
    file,
  ]);
  const captions = join(deps.outDir, language, `${plan.id}.srt`);
  await deps.files.write(captions, toSrt(captionsFor(timed)));
  return ok({ id: plan.id, title: plan.title, file, captions, seconds: Number(at.toFixed(1)) });
}
