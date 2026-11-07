import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import type { PlanBody } from './lesson-plan.ts';

/**
 * The categories a week's standards are grouped by on a printed plan: the five of the language
 * programs, and "other" for subjects without them (Math, Science, Social Studies).
 */
export const standardDomains = [
  'listening_speaking',
  'foundational_skills',
  'reading',
  'writing',
  'language',
  'other',
] as const;

export type StandardDomain = (typeof standardDomains)[number];

/**
 * Codes the teacher typed for each category: their school's or region's own standards (e.g.
 * Puerto Rico's), kept as written. They are the teacher's, never checked or written by the AI.
 */
export type DomainStandards = Readonly<Record<StandardDomain, readonly string[]>>;

export const noDomainStandards: DomainStandards = {
  listening_speaking: [],
  foundational_skills: [],
  reading: [],
  writing: [],
  language: [],
  other: [],
};

export const maxCodesPerDomain = 12;
export const maxTypedCodeLength = 40;

const isDomain = (value: string): value is StandardDomain =>
  (standardDomains as readonly string[]).includes(value);

function codes(field: string, values: readonly string[]): Result<string[], ValidationError> {
  const kept = [...new Set(values.map((code) => code.trim()).filter(Boolean))];
  if (kept.some((code) => /\s/u.test(code))) return invalid(field, 'invalid_format');
  if (kept.some((code) => code.length > maxTypedCodeLength)) return invalid(field, 'too_long');
  return kept.length > maxCodesPerDomain ? invalid(field, 'out_of_range') : ok(kept);
}

export function domainStandardsOf(
  field: string,
  input: Readonly<Record<string, readonly string[]>> | undefined,
): Result<DomainStandards, ValidationError> {
  const result: Record<StandardDomain, readonly string[]> = { ...noDomainStandards };
  for (const [domain, values] of Object.entries(input ?? {})) {
    if (!isDomain(domain)) return invalid(field, 'not_allowed');
    const checked = codes(`${field}.${domain}`, values);
    if (!checked.ok) return checked;
    result[domain] = checked.value;
  }
  return ok(result);
}

/** Common Core ELA strands by category; other codes have none. */
const strands: readonly [RegExp, StandardDomain][] = [
  [/^CCSS\.ELA-Literacy\.SL\./u, 'listening_speaking'],
  [/^CCSS\.ELA-Literacy\.RF\./u, 'foundational_skills'],
  [/^CCSS\.ELA-Literacy\.R(?:L|I|H|ST)\./u, 'reading'],
  [/^CCSS\.ELA-Literacy\.(?:W|WHST)\./u, 'writing'],
  [/^CCSS\.ELA-Literacy\.L\./u, 'language'],
];

export const standardDomainOf = (code: string): StandardDomain | null =>
  strands.find(([pattern]) => pattern.test(code))?.[1] ?? null;

/** A plan body as saved; plans saved before categories existed get empty ones. */
export function planBodyFromJson(json: unknown): PlanBody {
  const body = json as PlanBody;
  if (body.kind !== 'weekly') return body;
  return {
    ...body,
    weeks: body.weeks.map((week) => ({
      ...week,
      domainStandards: {
        ...noDomainStandards,
        ...(week.domainStandards as DomainStandards | undefined),
      },
    })),
  };
}
