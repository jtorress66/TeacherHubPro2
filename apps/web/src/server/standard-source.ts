import type { StandardInfo } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/** The list a standard comes from, as the teacher reads it. */
export function standardSourceName(locale: Locale, info: StandardInfo): string {
  const t = createTranslator(locale);
  return info.source === 'typed' ? t('standards.source_typed') : t(`standards.set_${info.source}`);
}
