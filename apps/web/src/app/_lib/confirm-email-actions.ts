'use server';

import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface ConfirmEmailState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly done?: boolean;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/** Confirms the email from an emailed link; the link's secret comes from its #hash. */
export async function confirmEmailAction(
  _state: ConfirmEmailState,
  data: FormData,
): Promise<ConfirmEmailState> {
  const confirmed = await getAppContainer().confirmEmail.execute({ token: text(data, 'token') });
  return confirmed.ok ? { done: true } : { errors: formErrors(confirmed.error, localeOf(data)) };
}

/** The app banner's Resend button: a new link for the signed-in person. */
export async function resendConfirmationAction(
  _state: ConfirmEmailState,
  data: FormData,
): Promise<ConfirmEmailState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const sent = await getAppContainer().resendEmailConfirmation.execute({ actor: user });
  return sent.ok ? { done: true } : { errors: formErrors(sent.error, locale) };
}
