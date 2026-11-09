import type { Locale } from '../locales.ts';
import type { Messages } from '../messages.ts';
import { de } from './de.ts';
import { en } from './en.ts';
import { es } from './es.ts';
import { fr } from './fr.ts';
import { it } from './it.ts';
import { pt } from './pt.ts';
import { zh } from './zh.ts';

/** Every language is translated in full. */
export type Catalogs = Readonly<Record<Locale, Messages>>;

export const catalogs: Catalogs = { en, es, fr, pt, de, it, zh };
