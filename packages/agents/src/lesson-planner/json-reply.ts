/** Small, total readers for a model's JSON reply; anything unexpected becomes null or empty. */

export type Json = Readonly<Record<string, unknown>>;

/** The JSON object in a reply, with or without a Markdown code fence around it. */
export function parseJsonObject(text: string): Json | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Json)
      : null;
  } catch {
    return null;
  }
}

export const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

export const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((item) => text(item) ?? []) : [];

export const objects = (value: unknown): Json[] =>
  Array.isArray(value)
    ? value.filter((item): item is Json => typeof item === 'object' && item !== null)
    : [];

/** Keeps only the values on the allowed list. */
export const allowed = <T extends string | number>(value: unknown, list: readonly T[]): T[] =>
  Array.isArray(value)
    ? value.filter((item): item is T => (list as readonly unknown[]).includes(item))
    : [];
