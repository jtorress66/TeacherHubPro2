import type { demoEn } from './demo-en.ts';
import type { marketingEn } from './marketing-en.ts';

type Strings<T> = { readonly [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The website copy's shape; English defines it, Spanish must match. */
export type MarketingMessages = Strings<typeof marketingEn>;

/** The product tour's shape; English defines it, every language must match. */
export type DemoMessages = Strings<typeof demoEn>;
