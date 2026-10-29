export * from './locales.ts';
export { resolveLocale, type LocaleHints } from './resolve-locale.ts';
export { createTranslator, type MessageParams, type Translate } from './translator.ts';
export { catalogs, type Catalogs } from './catalogs/index.ts';
export type { MessageKey, Messages, PartialMessages } from './messages.ts';
