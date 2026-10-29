'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import {
  logInForm,
  parseForm,
  profileForm,
  schoolForm,
  signUpForm,
  upgradeForm,
  type FieldErrors,
} from '../../server/forms.ts';
import { requireUser, setSessionCookie, takeSessionCookie } from './auth.ts';

export interface FormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
}

const fieldMessages = (errors: FieldErrors, locale: Locale): FormState => {
  const t = createTranslator(locale);
  return {
    errors: Object.fromEntries(
      Object.entries(errors).map(([field, code]) => [field, t(`errors.${code}`)]),
    ),
  };
};

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

export async function signUpAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(signUpForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, ...fields } = form.value;
  const result = await getAppContainer().signUp.execute({
    ...fields,
    language: locale,
    defaultSchoolName: createTranslator(locale)('defaults.schoolName'),
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  await setSessionCookie(result.value.sessionToken);
  redirect(`/${locale}/app`);
}

export async function logInAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(logInForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, ...credentials } = form.value;
  const result = await getAppContainer().logIn.execute(credentials);
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  await setSessionCookie(result.value.sessionToken);
  redirect(`/${locale}/app`);
}

export async function logOutAction(data: FormData): Promise<void> {
  const token = await takeSessionCookie();
  if (token !== undefined) await getAppContainer().logOut.execute(token);
  redirect(`/${localeOf(data)}`);
}

export async function updateProfileAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(profileForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { user } = await requireUser(form.value.locale);
  const result = await getAppContainer().updateProfile.execute({
    actor: user,
    name: form.value.name,
    language: form.value.language,
  });
  if (!result.ok) return { errors: formErrors(result.error, form.value.locale) };
  // A new language shows the app in that language straight away.
  if (result.value.language !== form.value.locale)
    redirect(`/${result.value.language}/app/settings`);
  return { saved: true };
}

export async function updateSchoolAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(schoolForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, ...details } = form.value;
  const { user, school } = await requireUser(locale);
  const result = await getAppContainer().updateSchoolDetails.execute({
    actor: user,
    schoolId: school.id,
    details,
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  // The school name shows in the app header and drives the setup checklist.
  revalidatePath(`/${locale}/app`, 'layout');
  return { saved: true };
}

export async function upgradeAction(_state: FormState, data: FormData): Promise<FormState> {
  const form = parseForm(upgradeForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, plan, quantity } = form.value;
  const { user } = await requireUser(locale, { needsAccess: false });
  const result = await getAppContainer().startCheckout.execute({
    actor: user,
    planId: plan,
    quantity,
    locale,
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  redirect(result.value.url);
}

/** Only addresses inside the app are followed, so links cannot redirect elsewhere. */
const insideApp = (url: string | null, fallback: string): string => {
  const appUrl = getAppContainer().appUrl;
  return url?.startsWith(`${appUrl}/`) ? url : fallback;
};

/** The "Pay" button of the in-app test checkout. Missing when a real provider is configured. */
export async function payLocalCheckoutAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { school, subscription } = await requireUser(locale, { needsAccess: false });
  const simulator = getAppContainer().localCheckout;
  const form = parseForm(upgradeForm, data);
  const billing = `${getAppContainer().appUrl}/${locale}/app/billing`;
  if (!simulator || !form.ok || subscription?.id !== data.get('subscription')) {
    redirect(`${billing}?checkout=unavailable`);
  }
  const paid = await simulator.pay({
    subscriptionId: subscription.id,
    schoolId: school.id,
    planId: form.value.plan,
    quantity: form.value.quantity,
  });
  const success = data.get('success');
  redirect(
    paid.ok
      ? insideApp(typeof success === 'string' ? success : null, billing)
      : `${billing}?checkout=unavailable`,
  );
}
