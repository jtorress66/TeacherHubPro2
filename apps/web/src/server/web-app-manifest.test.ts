import { describe, expect, it } from 'vitest';
import { routeLocale } from '../i18n/route-locale.ts';
import { webAppManifest } from './web-app-manifest.ts';

describe('the home-screen app', () => {
  const manifest = webAppManifest();

  it('opens full screen, like an app', () => {
    expect(manifest.name).toBe('TeacherHubPro');
    expect(manifest.display).toBe('standalone');
    expect(manifest.scope).toBe('/');
  });

  it("starts in the app, in the teacher's own language", () => {
    expect(manifest.start_url).toBe('/app');
    expect(routeLocale({ pathname: '/app', search: '', saved: 'es' })).toMatchObject({
      kind: 'redirect',
      to: '/es/app',
    });
  });

  it('uses the app icons', () => {
    expect(manifest.icons).toEqual([
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ]);
  });
});
