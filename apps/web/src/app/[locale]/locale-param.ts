import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@thp/i18n';

export interface LocaleParams {
  readonly params: Promise<{ locale: string }>;
}

/** The page's language from the URL; an unknown language is a 404. */
export async function localeFrom({ params }: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}
