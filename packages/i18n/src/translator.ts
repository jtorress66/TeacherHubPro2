import { catalogs as defaultCatalogs, type Catalogs } from './catalogs/index.ts';
import type { Locale } from './locales.ts';
import type { MessageKey } from './messages.ts';

export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

function lookup(tree: unknown, key: string): string | undefined {
  let node = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(text: string, params: MessageParams): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/** Returns `t(key)` for a language; keys missing from that catalog fall back to English. */
export function createTranslator(locale: Locale, catalogs: Catalogs = defaultCatalogs): Translate {
  return (key, params = {}) => {
    const text = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key) ?? key;
    return interpolate(text, params);
  };
}
