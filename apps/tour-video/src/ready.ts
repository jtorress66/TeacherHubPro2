import { join } from 'node:path';
import type { Locale } from '@thp/i18n';

export const manifestPath = (framesDir: string, locale: Locale): string =>
  join(framesDir, 'frames', locale, 'manifest.json');

/**
 * Splits the languages into those whose capture finished (it writes the manifest last) and those
 * that did not, so one language failing never costs the others their videos.
 */
export async function splitReady(
  locales: readonly Locale[],
  exists: (path: string) => Promise<boolean>,
  framesDir = '',
): Promise<{ readonly ready: Locale[]; readonly missing: Locale[] }> {
  const found = await Promise.all(
    locales.map(async (locale) => ({ locale, ok: await exists(manifestPath(framesDir, locale)) })),
  );
  return {
    ready: found.filter((f) => f.ok).map((f) => f.locale),
    missing: found.filter((f) => !f.ok).map((f) => f.locale),
  };
}
