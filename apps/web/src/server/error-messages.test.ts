import { describe, expect, it } from 'vitest';
import type { ApplicationErrorCode } from '@thp/application';
import type { ValidationCode } from '@thp/domain';
import { catalogs, createTranslator } from '@thp/i18n';
import { formErrors, messageFor, rejectedForm } from './error-messages.ts';

const applicationCodes: ApplicationErrorCode[] = [
  'email_taken',
  'invalid_credentials',
  'unauthenticated',
  'session_expired',
  'google_failed',
  'google_email_unverified',
  'forbidden',
  'not_found',
  'below_minimum_seats',
  'already_subscribed',
  'subscription_ended',
  'billing_failed',
  'invalid_signature',
  'unknown_subscription',
  'class_archived',
  'duplicate_student_number',
  'semester_in_use',
  'adult_required',
  'throwaway_email',
  'blocked_domain',
  'email_unconfirmed',
  'resend_limit',
  'account_suspended',
];

const validationCodes: ValidationCode[] = [
  'required',
  'invalid_format',
  'out_of_range',
  'too_short',
  'too_long',
  'not_allowed',
  'duplicate',
  'invalid_order',
];

describe('error messages', () => {
  it('every application error has a Spanish and an English message', () => {
    for (const locale of ['en', 'es'] as const) {
      for (const code of applicationCodes) {
        const message = messageFor({ code }, locale);
        expect(message, `${locale}:${code}`).not.toMatch(/^errors\./);
        expect(message.length).toBeGreaterThan(0);
      }
    }
  });

  it('every validation code has a message, and passwords have their own', () => {
    for (const code of validationCodes) {
      expect(messageFor({ field: 'name', code }, 'es')).not.toMatch(/^errors\./);
    }
    expect(messageFor({ field: 'password', code: 'too_short' }, 'en')).toBe(
      catalogs.en.errors.passwordTooShort,
    );
    expect(messageFor({ field: 'password', code: 'not_allowed' }, 'es')).toBe(
      catalogs.es.errors.passwordIsEmail,
    );
  });

  it('shows Spanish and English differently', () => {
    expect(messageFor({ code: 'email_taken' }, 'es')).not.toBe(
      messageFor({ code: 'email_taken' }, 'en'),
    );
  });

  it('puts each error under the form field it belongs to', () => {
    const t = createTranslator('en');
    expect(formErrors({ field: 'email', code: 'invalid_format' }, 'en')).toEqual({
      email: t('errors.invalid_format'),
    });
    expect(formErrors({ code: 'invalid_credentials' }, 'en')).toEqual({
      form: t('errors.invalid_credentials'),
    });
    expect(formErrors({ code: 'email_taken' }, 'en')).toEqual({ email: t('errors.email_taken') });
    expect(formErrors({ code: 'below_minimum_seats' }, 'en')).toEqual({
      quantity: t('errors.below_minimum_seats'),
    });
    expect(formErrors({ code: 'adult_required' }, 'en')).toEqual({
      adult: t('errors.adult_required'),
    });
    for (const code of ['throwaway_email', 'blocked_domain'] as const) {
      expect(formErrors({ code }, 'en')).toEqual({ email: t(`errors.${code}`) });
    }
    expect(formErrors({ field: 'domain', code: 'invalid_format' }, 'en')).toEqual({
      domain: t('errors.invalid_format'),
    });
  });

  it('names the range when a number is out of it, in every language', () => {
    const error = {
      field: 'questionCount',
      code: 'out_of_range',
      range: { min: 1, max: 100 },
    } as const;
    expect(messageFor(error, 'en')).toBe('Choose a number from 1 to 100.');
    expect(messageFor(error, 'es')).toBe('Elige un número del 1 al 100.');
    expect(formErrors(error, 'en')).toEqual({ questionCount: 'Choose a number from 1 to 100.' });
    for (const locale of ['fr', 'pt', 'de', 'it', 'zh'] as const) {
      expect(messageFor(error, locale)).toMatch(/1\D+100/);
    }
    expect(messageFor({ field: 'score', code: 'out_of_range' }, 'en')).toBe(
      catalogs.en.errors.out_of_range,
    );
  });

  it('hands the form back what was sent with the errors, so nothing typed is lost', () => {
    const data = new FormData();
    data.append('type', 'quiz');
    data.append('questionCount', '101');
    data.append('password', 'never-sent-back');
    const error = {
      field: 'questionCount',
      code: 'out_of_range',
      range: { min: 1, max: 100 },
    } as const;
    expect(rejectedForm(error, 'en', data)).toEqual({
      errors: { questionCount: 'Choose a number from 1 to 100.' },
      values: { type: 'quiz', questionCount: '101' },
    });
  });
});
