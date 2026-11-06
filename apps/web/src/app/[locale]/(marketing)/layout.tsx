import type { ReactNode } from 'react';

/** Pages render on request: their canonical and sitemap addresses come from the server's APP_URL. */
export const dynamic = 'force-dynamic';

export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
