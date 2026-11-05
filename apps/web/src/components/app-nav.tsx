'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@thp/i18n';
import { logOutAction } from '../app/_lib/actions.ts';
import { NavIcon, type NavIconName } from './nav-icons.tsx';

export interface NavGroup {
  readonly title: string;
  readonly links: readonly {
    readonly href: string;
    readonly label: string;
    readonly icon: NavIconName;
    /** A count waiting for the teacher, such as prep batches to review; hidden at zero. */
    readonly badge?: number;
  }[];
}

/** The longest link that the current page sits under is the current one. */
function currentHref(pathname: string, hrefs: readonly string[]): string | null {
  const matches = hrefs.filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * The app's sidebar navigation: grouped links with icons, the current page marked, and a menu
 * button that shows or hides it on small screens.
 */
export function AppNav(props: {
  readonly locale: Locale;
  readonly label: string;
  readonly menuLabel: string;
  readonly logOutLabel: string;
  readonly groups: readonly NavGroup[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = currentHref(
    pathname,
    props.groups.flatMap((group) => group.links.map((link) => link.href)),
  );
  return (
    <>
      <button
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="app-nav"
        onClick={() => {
          setOpen(!open);
        }}
      >
        <NavIcon name="menu" />
        {props.menuLabel}
      </button>
      <nav id="app-nav" aria-label={props.label} className="sidebar-nav" data-open={open}>
        {props.groups.map((group) => (
          <div className="nav-group" key={group.title}>
            <p className="nav-group-title">{group.title}</p>
            <ul>
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={link.href === current ? 'page' : undefined}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    <NavIcon name={link.icon} />
                    {link.label}
                    {link.badge === undefined || link.badge === 0 ? null : (
                      <span className="nav-badge" data-testid="nav-badge">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <form action={logOutAction} className="nav-logout">
          <input type="hidden" name="locale" value={props.locale} />
          <button type="submit">
            <NavIcon name="logOut" />
            {props.logOutLabel}
          </button>
        </form>
      </nav>
    </>
  );
}
