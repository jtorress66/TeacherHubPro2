import type { MetadataRoute } from 'next';
import { webAppManifest } from '../server/web-app-manifest.ts';

/** Lets a teacher add TeacherHubPro to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return webAppManifest();
}
