import type { en } from './catalogs/en.ts';

type Strings<T> = { readonly [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };
type Partially<T> = { readonly [K in keyof T]?: T[K] extends string ? string : Partially<T[K]> };
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Shape of a complete catalog. English defines it. */
export type Messages = Strings<typeof en>;

/** A catalog that may omit keys; missing keys fall back to English. */
export type PartialMessages = Partially<Messages>;

/** Every translatable key, as a dot path such as `home.title`. */
export type MessageKey = Paths<Messages>;
