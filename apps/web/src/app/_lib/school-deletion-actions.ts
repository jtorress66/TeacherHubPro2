'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface SchoolDeletionState {
  readonly errors?: Readonly<Record<string, string>>;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/** Asks to delete all of the school's data; the notice then shows on every app page. */
export async function requestSchoolDeletionAction(
  _state: SchoolDeletionState,
  data: FormData,
): Promise<SchoolDeletionState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const requested = await getAppContainer().requestSchoolDeletion.execute({
    actor: user,
    typedName: text(data, 'schoolName'),
  });
  if (!requested.ok) return { errors: formErrors(requested.error, locale) };
  revalidatePath(`/${locale}/app`, 'layout');
  return {};
}

/** Keeps the school's data, and says so on the settings page. */
export async function cancelSchoolDeletionAction(
  _state: SchoolDeletionState,
  data: FormData,
): Promise<SchoolDeletionState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const canceled = await getAppContainer().cancelSchoolDeletion.execute({ actor: user });
  if (!canceled.ok) return { errors: formErrors(canceled.error, locale) };
  revalidatePath(`/${locale}/app`, 'layout');
  redirect(`/${locale}/app/settings?deletion=canceled`);
}
