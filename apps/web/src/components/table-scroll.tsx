import type { ReactNode } from 'react';

/**
 * A box a wide table scrolls inside, so the page itself never slides sideways (WCAG 1.4.10). It
 * takes keyboard focus, so people without a mouse can scroll it with the arrow keys (2.1.1).
 */
export function TableScroll({ children }: { readonly children: ReactNode }) {
  return (
    <div className="table-scroll" tabIndex={0}>
      {children}
    </div>
  );
}
