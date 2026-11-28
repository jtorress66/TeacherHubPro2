import { err, ok, type Result } from '@thp/domain';
import { isLocale, locales, type Locale } from '@thp/i18n';

export type VoiceConfig =
  { readonly provider: 'local' } | { readonly provider: 'openai'; readonly apiKey: string };

export interface VideoConfig {
  readonly framesDir: string;
  readonly outDir: string;
  readonly locales: readonly Locale[];
  /** Video ids to make (e.g. `overview`); empty makes them all. */
  readonly only: readonly string[];
  readonly voice: VoiceConfig;
  readonly voiceName: string;
}

const list = (value: string | undefined): string[] =>
  (value ?? '').split(/[\s,]+/u).filter(Boolean);

/**
 * The video tool's settings. Without TTS_PROVIDER=openai the voice is a free silent stand-in,
 * for previews; the real voice costs money and runs only when the owner asks.
 */
export function parseVideoConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<VideoConfig, string> {
  const framesDir = env.TOUR_FRAMES?.trim() ?? '';
  if (framesDir === '') {
    return err('Set TOUR_FRAMES to the folder `pnpm tour:capture` wrote frames to.');
  }
  const chosen = list(env.TOUR_LOCALES);
  const unknown = chosen.filter((l) => !isLocale(l));
  if (unknown.length > 0) return err(`TOUR_LOCALES has unknown languages: ${unknown.join(', ')}.`);

  let voice: VoiceConfig = { provider: 'local' };
  if (env.TTS_PROVIDER?.trim().toLowerCase() === 'openai') {
    const apiKey = env.OPENAI_API_KEY?.trim() ?? '';
    if (apiKey === '') return err('OPENAI_API_KEY is required when TTS_PROVIDER is "openai".');
    voice = { provider: 'openai', apiKey };
  }

  const out = env.TOUR_VIDEOS_OUT?.trim() ?? '';
  const name = env.TOUR_VOICE?.trim() ?? '';
  return ok({
    framesDir,
    outDir: out === '' ? `${framesDir}/videos` : out,
    locales: chosen.length === 0 ? [...locales] : chosen.filter(isLocale),
    only: list(env.TOUR_ONLY),
    voice,
    voiceName: name === '' ? 'coral' : name,
  });
}
