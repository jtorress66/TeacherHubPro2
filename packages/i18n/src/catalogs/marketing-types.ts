import type { marketingEn } from './marketing-en.ts';

type Strings<T> = { readonly [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The website copy's shape; English defines it, Spanish must match. */
export type MarketingMessages = Strings<typeof marketingEn>;
