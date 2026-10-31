import { join } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  transpilePackages: ['@thp/i18n'],
  // Server-only libraries loaded as they are, not bundled (PDF.js does not bundle cleanly).
  serverExternalPackages: ['unpdf'],
  // ESLint runs once for the whole monorepo (`pnpm lint`).
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default config;
