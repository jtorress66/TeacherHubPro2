import type { UseCaseError } from '@thp/application';
import type { JobFailure, ValidationCode } from '@thp/domain';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import { formErrors } from './error-messages.ts';
import { planFieldName } from './plan-forms.ts';

/** Planner wording where the shared message is too vague, by the last part of the field path. */
const fieldKeys: Readonly<Record<string, Partial<Record<ValidationCode, MessageKey>>>> = {
  weekStart: { not_allowed: 'planner.errors.notMonday', invalid_order: 'planner.errors.weekOrder' },
  standards: { not_allowed: 'planner.errors.standards' },
  skills: { out_of_range: 'planner.errors.skills' },
  weeks: { out_of_range: 'planner.errors.weeks' },
  start: { not_allowed: 'planner.errors.notMonday' },
};

/** A refused plan as `{ formField: message }`, under the editor's own field names. */
export function planErrors(error: UseCaseError, locale: Locale): Record<string, string> {
  if (!('field' in error)) return formErrors(error, locale);
  const last = error.field.split('.').at(-1) ?? error.field;
  const key = fieldKeys[last]?.[error.code];
  const name = planFieldName(error.field);
  return key
    ? { [name]: createTranslator(locale)(key) }
    : formErrors({ ...error, field: name }, locale);
}

/** Why a draft job failed, in the teacher's language. */
export const draftFailureMessage = (error: string | null, locale: Locale): string => {
  const known: readonly JobFailure[] = [
    'timed_out',
    'ai_unavailable',
    'invalid_output',
    'unknown_kind',
    'failed',
  ];
  const code = known.find((failure) => failure === error) ?? 'failed';
  return createTranslator(locale)(`drafts.failed_${code}`);
};
