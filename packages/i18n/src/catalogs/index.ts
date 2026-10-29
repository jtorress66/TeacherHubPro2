import type { Locale } from '../locales.ts';
import type { Messages, PartialMessages } from '../messages.ts';
import { de } from './de.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { it } from './it.ts';
import { pt } from './pt.ts';
import { zh } from './zh.ts';

export type Catalogs = { readonly en: Messages; readonly es: Messages } & Readonly<
  Record<Exclude<Locale, 'en' | 'es'>, PartialMessages>
>;

export const catalogs: Catalogs = { en, es, fr, pt, de, it, zh };
