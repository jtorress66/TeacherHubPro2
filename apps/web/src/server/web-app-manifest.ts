import type { MetadataRoute } from 'next';

/**
 * What a phone needs to put TeacherHubPro on its home screen and open it full screen. The name is
 * the brand, the same in every language; `/app` lands in the teacher's saved language.
 */
export function webAppManifest(): MetadataRoute.Manifest {
  return {
    name: 'TeacherHubPro',
    short_name: 'TeacherHubPro',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#1d4ed8',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
