import 'server-only';
import type { Metadata } from 'next';
import { createTranslator, isLocale, type Locale, type MessageKey } from '@thp/i18n';
import { getAppContainer } from '../container.ts';
import { pageMetadata } from './marketing-pages.ts';

/** A public page's search-engine metadata, from its title and description strings. */
export function marketingMetadata(
  locale: string,
  path: string,
  titleKey: MessageKey,
  descriptionKey: MessageKey,
): Metadata {
  const language: Locale = isLocale(locale) ? locale : 'en';
  const t = createTranslator(language);
  return pageMetadata(getAppContainer().appUrl, language, path, t(titleKey), t(descriptionKey));
}
