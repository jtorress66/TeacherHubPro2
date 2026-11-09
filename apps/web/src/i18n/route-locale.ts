import { isLocale, resolveLocale, type Locale } from '@thp/i18n';
import { currentPathFor } from './legacy-paths.ts';

export interface LocaleRequest {
  readonly pathname: string;
  /** Raw query string, with or without the leading `?`. */
  readonly search: string;
  /** Language saved from an earlier visit (cookie). */
  readonly saved: string | undefined;
}

export type LocaleRoute =
  | {
      readonly kind: 'redirect';
      readonly to: string;
      readonly save: Locale;
      /** An old app address that moved for good (search engines update their links). */
      readonly permanent?: true;
    }
  | { readonly kind: 'next'; readonly save: Locale };

/** Decides whether a request needs a language prefix and which language to remember. */
export function routeLocale({ pathname, search, saved }: LocaleRequest): LocaleRoute {
  const params = new URLSearchParams(search);
  const queryLang = params.get('lang');
  const [, first = '', ...rest] = pathname.split('/');
  const current = isLocale(first) ? first : undefined;

  if (current !== undefined && !isLocale(queryLang)) return { kind: 'next', save: current };

  const locale = resolveLocale({ queryLang, saved: current ?? saved });
  const moved = current === undefined ? currentPathFor(pathname) : null;
  const remainder = moved ?? (current === undefined ? pathname : `/${rest.join('/')}`);
  params.delete('lang');
  const query = params.toString();
  const path = `/${locale}${remainder === '/' ? '' : remainder}`;

  const to = query ? `${path}?${query}` : path;
  return moved === null
    ? { kind: 'redirect', to, save: locale }
    : { kind: 'redirect', to, save: locale, permanent: true };
}
