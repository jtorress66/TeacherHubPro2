import type { MetadataRoute } from 'next';
import { getAppContainer } from '../container.ts';
import { robotsRules } from '../server/marketing-pages.ts';

export const dynamic = 'force-dynamic';

/** Crawlers may read the public site, never the app, private links or the API. */
export default function robots(): MetadataRoute.Robots {
  const { allow, disallow, sitemap } = robotsRules(getAppContainer().appUrl);
  return { rules: { userAgent: '*', allow, disallow }, sitemap };
}
