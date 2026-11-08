'use server';

import { isLocale, type Locale } from '@thp/i18n';
import { callerAddress, throttle } from './limits.ts';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';

export interface PasswordFormState {
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
  if (limited !== null) return { errors: formErrors(limited, locale) };
  const sent = await getAppContainer().requestPasswordReset.execute({
    email: text(data, 'email').trim(),
  });
  return sent.ok ? { done: true } : { errors: formErrors(sent.error, locale) };
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
    : { errors: formErrors(promoted.error, locale) };
}
