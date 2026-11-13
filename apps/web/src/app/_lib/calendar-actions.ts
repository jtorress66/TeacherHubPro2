'use server';

import { revalidatePath } from 'next/cache';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { messageFor } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface CalendarLinkState {
  /** The full address of a link just made; shown once, never stored. */
  readonly url?: string;
  readonly error?: string;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

/** Makes the teacher's calendar link (replacing any earlier one) and shows it once. */
export async function makeCalendarLinkAction(
  _state: CalendarLinkState,
  data: FormData,
): Promise<CalendarLinkState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const made = await getAppContainer().makeCalendarLink.execute({ actor: user });
  revalidatePath(`/${locale}/app/integrations`);
  return made.ok ? { url: made.value.url } : { error: messageFor(made.error, locale) };
}

/** Stops the teacher's calendar link working. */
export async function turnOffCalendarLinkAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().turnOffCalendarLink.execute({ actor: user });
  revalidatePath(`/${locale}/app/integrations`);
}
