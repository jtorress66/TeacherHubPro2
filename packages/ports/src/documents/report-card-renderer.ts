import type { StoredFile } from '../files/file-store.ts';

/** A label and its value, already translated and formatted. */
export interface DocumentFact {
  readonly label: string;
  readonly value: string;
}

/** The building blocks of a report card page; every string is ready to print. */
export type ReportCardSection =
  | { readonly kind: 'facts'; readonly items: readonly DocumentFact[] }
  | {
      readonly kind: 'table';
      readonly title: string;
      readonly headers: readonly string[];
      readonly rows: readonly (readonly string[])[];
      readonly empty: string;
    }
  | { readonly kind: 'text'; readonly title: string; readonly text: string }
  | { readonly kind: 'signatures'; readonly labels: readonly string[] };

export interface ReportCardPage {
  readonly schoolName: string;
  /** Address, phone and email on one line, when the school has any. */
  readonly schoolDetails: string | null;
  readonly logo: StoredFile | null;
  readonly title: string;
  readonly sections: readonly ReportCardSection[];
}

/** Lays report cards out as a PDF, one page per card. It decides nothing about grades. */
export interface ReportCardRenderer {
  render(pages: readonly [ReportCardPage, ...ReportCardPage[]]): Promise<Uint8Array>;
}
