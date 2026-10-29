import { join } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingRoot: join(import.meta.dirname, '../..'),
  transpilePackages: ['@thp/i18n'],
  // ESLint runs once for the whole monorepo (`pnpm lint`).
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default config;
