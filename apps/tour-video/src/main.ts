import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { trialDays } from '@thp/domain';
import { parseVideoConfig } from './config.ts';
import { videoContainer } from './container.ts';
import { makeVideo, type MadeVideo } from './make-video.ts';
import { manifestSchema } from './manifest.ts';
import { manifestPath, splitReady } from './ready.ts';
import { planVideos } from './script.ts';

// `pnpm --filter @thp/tour-video make`: turns the frames from `TOUR_FRAMES=… pnpm tour:capture`
// into narrated, captioned videos, one overview and one per chapter, per language.

const config = parseVideoConfig(process.env);
if (!config.ok) {
  console.error(config.error);
  process.exit(1);
}
const settings = config.value;
const deps = {
  ...videoContainer(settings),
  framesDir: settings.framesDir,
  outDir: settings.outDir,
  paced: settings.voice.provider === 'local',
};

console.log(
  settings.voice.provider === 'local'
    ? 'Silent preview (no voice service is called).'
    : `Narrating with OpenAI, voice "${settings.voiceName}". Lines already spoken are reused.`,
);

const { ready, missing } = await splitReady(
  settings.locales,
  (path) =>
    access(path).then(
      () => true,
      () => false,
    ),
  settings.framesDir,
);
if (missing.length > 0) {
  console.error(`No finished capture for: ${missing.join(', ')}. Making the others.`);
}

for (const locale of ready) {
  const raw = await readFile(manifestPath(settings.framesDir, locale), 'utf8');
  const manifest = manifestSchema.parse(JSON.parse(raw));
  const plans = planVideos(manifest, locale, trialDays).filter(
    (plan) => settings.only.length === 0 || settings.only.includes(plan.id),
  );
  const made: (MadeVideo & { readonly description: string })[] = [];
  for (const plan of plans) {
    const video = await makeVideo(deps, plan, locale);
    if (!video.ok) {
      const { scene, reason } = video.error;
      console.error(
        `${locale} ${plan.id}: the voice failed on scene ${String(scene)} (${reason}).`,
      );
      process.exit(1);
    }
    made.push({ ...video.value, description: plan.description });
    console.log(`${locale} ${plan.id}: ${String(video.value.seconds)} s`);
  }
  await deps.files.write(
    join(settings.outDir, locale, 'videos.json'),
    `${JSON.stringify(made, null, 2)}\n`,
  );
}

// Every language that was asked for and could not be made fails the run, after the others.
if (missing.length > 0) process.exitCode = 1;
