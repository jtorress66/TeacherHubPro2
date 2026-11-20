'use server';

import { revalidatePath } from 'next/cache';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface SchoolFeaturesState {
  readonly saved?: boolean;
  readonly errors?: Readonly<Record<string, string>>;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

/** Saves the school-wide switches; an unticked box means off. */
export async function setSchoolFeaturesAction(
  _state: SchoolFeaturesState,
  data: FormData,
): Promise<SchoolFeaturesState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const saved = await getAppContainer().setSchoolFeatures.execute({
    actor: user,
    features: { ai: data.get('ai') === 'on', studentFlags: data.get('studentFlags') === 'on' },
  });
  if (!saved.ok) return { errors: formErrors(saved.error, locale) };
  revalidatePath(`/${locale}/app`, 'layout');
  return { saved: true };
}
