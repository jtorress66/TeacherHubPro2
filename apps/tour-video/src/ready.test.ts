import { describe, expect, it } from 'vitest';
import { splitReady } from './ready.ts';

describe('splitReady', () => {
  it('makes videos for the languages whose capture finished, and names the ones that did not', async () => {
    const finished = new Set(['frames/en/manifest.json', 'frames/es/manifest.json']);
    const result = await splitReady(['en', 'zh', 'es'], (path) =>
      Promise.resolve(finished.has(path.replaceAll('\\', '/'))),
    );
    expect(result).toEqual({ ready: ['en', 'es'], missing: ['zh'] });
  });
});
