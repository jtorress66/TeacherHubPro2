'use server';

import { isLocale, type Locale } from '@thp/i18n';
import { callerAddress, throttle } from './limits.ts';
import type { SubmittedValues } from '../../server/form-values.ts';
import { getAppContainer } from '../../container.ts';
import { formErrors, rejectedForm } from '../../server/error-messages.ts';

export interface PasswordFormState {
  /** What the teacher sent, when it was refused, so the form shows it again. */
  readonly values?: SubmittedValues;
  readonly errors?: Readonly<Record<string, string>>;
  readonly done?: boolean;
  /** The email the setup page promoted. */
  readonly email?: string;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/** "Forgot password?": the answer is the same whether or not the email has an account. */
export async function requestPasswordResetAction(
  _state: PasswordFormState,
  data: FormData,
): Promise<PasswordFormState> {
  const locale = localeOf(data);
  const limited = await throttle([['passwordReset', await callerAddress()]]);
  if (limited !== null) return rejectedForm(limited, locale, data);
  const sent = await getAppContainer().requestPasswordReset.execute({
    email: text(data, 'email').trim(),
  });
  return sent.ok ? { done: true } : rejectedForm(sent.error, locale, data);
}

/** Saves the password chosen from an emailed link; the link's secret comes from its #hash. */
export async function setPasswordAction(
  _state: PasswordFormState,
  data: FormData,
): Promise<PasswordFormState> {
  const locale = localeOf(data);
  const saved = await getAppContainer().setPassword.execute({
    token: text(data, 'token'),
    password: text(data, 'password'),
  });
  return saved.ok ? { done: true } : { errors: formErrors(saved.error, locale) };
}

/** Makes an existing account the first super admin, with the server's setup key. */
export async function setUpSuperAdminAction(
  _state: PasswordFormState,
  data: FormData,
): Promise<PasswordFormState> {
  const locale = localeOf(data);
  const promoted = await getAppContainer().setUpFirstSuperAdmin.execute({
    email: text(data, 'email').trim(),
    key: text(data, 'key'),
  });
  return promoted.ok
    ? { done: true, email: promoted.value.email }
    : // Only the email comes back: the setup key is a secret.
      { errors: formErrors(promoted.error, locale), values: { email: text(data, 'email') } };
}
