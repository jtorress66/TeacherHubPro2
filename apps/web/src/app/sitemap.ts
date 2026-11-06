import type { MetadataRoute } from 'next';
import { getAppContainer } from '../container.ts';
import { sitemapEntries } from '../server/marketing-pages.ts';

export const dynamic = 'force-dynamic';

/** Every public page in every language, with its English and Spanish alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(getAppContainer().appUrl).map((entry) => ({
    url: entry.url,
    alternates: { languages: { ...entry.alternates } },
  }));
}
