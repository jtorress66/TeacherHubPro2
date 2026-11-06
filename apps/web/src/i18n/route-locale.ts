import { isLocale, resolveLocale, type Locale } from '@thp/i18n';

export interface LocaleRequest {
  readonly pathname: string;
  /** Raw query string, with or without the leading `?`. */
  readonly search: string;
  /** Language saved from an earlier visit (cookie). */
  readonly saved: string | undefined;
}

export type LocaleRoute =
  | { readonly kind: 'redirect'; readonly to: string; readonly save: Locale }
  | { readonly kind: 'next'; readonly save: Locale };

/**
 * Links shared from the old app, by their first path segment: family and learning links open
 * their new pages (their tokens were carried over as hashes); assignment and game links, which
 * matched students by a typed name, lead to a page asking for the new personal link.
 */
const oldLinks: Readonly<Record<string, (token: string) => string>> = {
  portal: (token) => `/p/${token}`,
  'homeschool-portal': (token) => `/p/${token}`,
  'student-learning': (token) => `/s/${token}`,
  assignment: () => '/old-link',
  'play-game': () => '/old-link',
};

function newPath(pathname: string): string {
  const [, first = '', token, ...more] = pathname.split('/');
  const target = oldLinks[first];
  return target === undefined || token === undefined || token === '' || more.length > 0
    ? pathname
    : target(token);
}

/** Decides whether a request needs a language prefix and which language to remember. */
export function routeLocale({ pathname, search, saved }: LocaleRequest): LocaleRoute {
  const params = new URLSearchParams(search);
  const queryLang = params.get('lang');
  const [, first = '', ...rest] = pathname.split('/');
  const current = isLocale(first) ? first : undefined;

  if (current !== undefined && !isLocale(queryLang)) return { kind: 'next', save: current };

  const locale = resolveLocale({ queryLang, saved: current ?? saved });
  const remainder = current === undefined ? newPath(pathname) : `/${rest.join('/')}`;
  params.delete('lang');
  const query = params.toString();
  const path = `/${locale}${remainder === '/' ? '' : remainder}`;

  return { kind: 'redirect', to: query ? `${path}?${query}` : path, save: locale };
}
