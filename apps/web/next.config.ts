import { join } from 'node:path';
import type { NextConfig } from 'next';
import { securityHeaders } from './src/server/security-headers.ts';

const config: NextConfig = {
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  transpilePackages: ['@thp/i18n'],
  // Server-only libraries loaded as they are, not bundled (PDF.js does not bundle cleanly).
  serverExternalPackages: ['unpdf'],
  // ESLint runs once for the whole monorepo (`pnpm lint`).
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  // Titles and descriptions go in the page's <head> for every visitor, not streamed in after the
  // content, so screen readers and search engines always see them.
  htmlLimitedBots: /.*/,
  headers: () => Promise.resolve([{ source: '/:path*', headers: [...securityHeaders] }]),
};

export default config;
