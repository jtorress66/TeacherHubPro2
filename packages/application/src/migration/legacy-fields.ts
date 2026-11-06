import type { LegacyDocument } from '@thp/ports';

/** Readers for old records, whose fields may be missing, blank or of an unexpected type. */

/** Non-blank text (numbers are read as text); anything else is null. */
export function text(doc: LegacyDocument, key: string): string | null {
  const value = doc[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function number(doc: LegacyDocument, key: string): number | null {
  const value = doc[key];
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

export const flag = (doc: LegacyDocument, key: string): boolean => doc[key] === true;

const isRecord = (value: unknown): value is LegacyDocument =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function record(doc: LegacyDocument, key: string): LegacyDocument | null {
  const value = doc[key];
  return isRecord(value) ? value : null;
}

export function list(doc: LegacyDocument, key: string): readonly unknown[] {
  const value = doc[key];
  return Array.isArray(value) ? value : [];
}

export const records = (doc: LegacyDocument, key: string): readonly LegacyDocument[] =>
  list(doc, key).filter(isRecord);

export const strings = (doc: LegacyDocument, key: string): readonly string[] =>
  list(doc, key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value !== '');

/** A moment stored as an ISO string (or a date the export turned into one). */
export function instant(doc: LegacyDocument, key: string): Date | null {
  const value = text(doc, key);
  if (value === null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A calendar date `YYYY-MM-DD`, from a date or the start of an ISO timestamp. */
export function day(doc: LegacyDocument, key: string): string | null {
  const value = text(doc, key);
  const match = value === null ? null : /^(\d{4}-\d{2}-\d{2})/u.exec(value);
  return match?.[1] ?? null;
}
