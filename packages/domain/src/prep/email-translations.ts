import { languages, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';
import { checkParentEmail, type ParentEmail } from './parent-email.ts';
import type { PrepBatch } from './prep-batch.ts';

/** The parent email in a family's language, drafted by the AI and checked by the teacher. */
export interface EmailTranslation extends ParentEmail {
  readonly language: Language;
}

/** The translations of one version of the email (`source`); a changed email drops them. */
export interface EmailTranslations {
  readonly status: 'running' | 'ready' | 'failed';
  readonly languages: readonly Language[];
  readonly source: ParentEmail;
  readonly items: readonly EmailTranslation[];
}

/**
 * The languages, other than the email's, that families with an address read, and how many, in
 * the app's language order.
 */
export function familyLanguages(
  students: readonly {
    readonly parentEmail: string | null;
    readonly familyLanguage: Language | null;
  }[],
  emailLanguage: Language,
): { readonly language: Language; readonly families: number }[] {
  const addresses = new Map<Language, Set<string>>();
  for (const { parentEmail, familyLanguage } of students) {
    if (parentEmail === null || familyLanguage === null || familyLanguage === emailLanguage) {
      continue;
    }
    addresses.set(familyLanguage, (addresses.get(familyLanguage) ?? new Set()).add(parentEmail));
  }
  return languages
    .filter((language) => addresses.has(language))
    .map((language) => ({ language, families: addresses.get(language)?.size ?? 0 }));
}

const sameEmail = (a: ParentEmail, b: ParentEmail) => a.subject === b.subject && a.body === b.body;

/** Starts translating the current email; any earlier drafts are replaced. */
export function startTranslations(
  batch: PrepBatch,
  languages: readonly Language[],
): Result<PrepBatch, ValidationError> {
  if (batch.status !== 'ready' || batch.parentEmail === null) {
    return invalid('status', 'not_allowed');
  }
  if (languages.length === 0) return invalid('languages', 'required');
  return ok({
    ...batch,
    translations: { status: 'running', languages, source: batch.parentEmail, items: [] },
  });
}

const isRunningFor = (batch: PrepBatch, source: ParentEmail) =>
  batch.translations?.status === 'running' && sameEmail(batch.translations.source, source);

/** Keeps the drafts, unless the email has changed since they were asked for. */
export function finishTranslations(
  batch: PrepBatch,
  source: ParentEmail,
  items: readonly EmailTranslation[],
): PrepBatch {
  if (batch.translations === null || !isRunningFor(batch, source)) return batch;
  return { ...batch, translations: { ...batch.translations, status: 'ready', items } };
}

export function failTranslations(batch: PrepBatch, source: ParentEmail): PrepBatch {
  if (batch.translations === null || !isRunningFor(batch, source)) return batch;
  return { ...batch, translations: { ...batch.translations, status: 'failed' } };
}

/** The teacher's changes to the drafts; each must be a draft there is, and a valid email. */
export function editTranslations(
  batch: PrepBatch,
  edits: readonly EmailTranslation[],
): Result<PrepBatch, ValidationError> {
  const translations = batch.translations;
  if (translations?.status !== 'ready') return invalid('status', 'not_allowed');
  const items = [...translations.items];
  for (const edit of edits) {
    const index = items.findIndex((item) => item.language === edit.language);
    if (index === -1) return invalid('language', 'not_allowed');
    const checked = checkParentEmail(edit);
    if (!checked.ok) return checked;
    items[index] = { language: edit.language, ...checked.value };
  }
  return ok({ ...batch, translations: { ...translations, items } });
}

/** A changed email drops the translations of the old one. */
export const withEmail = (batch: PrepBatch, email: ParentEmail): PrepBatch => ({
  ...batch,
  parentEmail: email,
  translations:
    batch.translations !== null && sameEmail(batch.translations.source, email)
      ? batch.translations
      : null,
});

/**
 * What a family reading `language` is sent: its checked draft, or else the teacher's email in
 * the email's own language.
 */
export function emailFor(batch: PrepBatch, language: Language): EmailTranslation | null {
  if (batch.parentEmail === null) return null;
  const draft =
    batch.translations?.status === 'ready'
      ? batch.translations.items.find((item) => item.language === language)
      : undefined;
  return draft ?? { language: batch.request.language, ...batch.parentEmail };
}
