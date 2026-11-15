import type { ApplicationErrorCode, UseCaseError } from '@thp/application';
import type { ValidationCode } from '@thp/domain';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import { submittedValues, type SubmittedValues } from './form-values.ts';

const passwordKeys: Partial<Record<ValidationCode, MessageKey>> = {
  too_short: 'errors.passwordTooShort',
  too_long: 'errors.passwordTooLong',
  not_allowed: 'errors.passwordIsEmail',
};

/** The form field an application error belongs under; `form` for errors about the whole form. */
const fieldOf: Partial<Record<ApplicationErrorCode, string>> = {
  email_taken: 'email',
  below_minimum_seats: 'quantity',
  adult_required: 'adult',
  throwaway_email: 'email',
  blocked_domain: 'email',
};

/** A use case error as a message in the page's language. */
export function messageFor(error: UseCaseError, locale: Locale): string {
  const t = createTranslator(locale);
  if ('range' in error) {
    return t('errors.outOfRangeBetween', { min: error.range.min, max: error.range.max });
  }
  return t(keyFor(error));
}

function keyFor(error: UseCaseError): MessageKey {
  if ('field' in error) {
    return (
      (error.field === 'password' ? passwordKeys[error.code] : undefined) ?? `errors.${error.code}`
    );
  }
  return `errors.${error.code}`;
}

/** A use case error as `{ field: message }` for a form. */
export function formErrors(error: UseCaseError, locale: Locale): Record<string, string> {
  const field = 'field' in error ? error.field : (fieldOf[error.code] ?? 'form');
  return { [field]: messageFor(error, locale) };
}

/** A form sent back with its errors and what the teacher sent, so the form can show it again. */
export function rejectedForm(
  error: UseCaseError,
  locale: Locale,
  data: FormData,
): { errors: Record<string, string>; values: SubmittedValues } {
  return { errors: formErrors(error, locale), values: submittedValues(data) };
}
