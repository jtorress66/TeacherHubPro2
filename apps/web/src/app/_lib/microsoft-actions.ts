'use server';

import { revalidatePath } from 'next/cache';
import type { GenerationId, PresentationId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { messageFor } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface OneDriveFormState {
  /** The link to the saved file in the teacher's OneDrive. */
  readonly webUrl?: string;
  readonly error?: string;
  /** True when the teacher needs to connect Microsoft in Settings first. */
  readonly connect?: boolean;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** Saves a presentation or AI-written material in the teacher's OneDrive. */
export async function saveToOneDriveAction(
  _state: OneDriveFormState,
  data: FormData,
): Promise<OneDriveFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const microsoft = getAppContainer().microsoft;
  if (microsoft === null) return { error: messageFor({ code: 'not_found' }, locale) };
  const id = text(data, 'id');
  const saved =
    text(data, 'kind') === 'presentation'
      ? await microsoft.savePresentation.execute({
          actor: user,
          presentationId: id as PresentationId,
        })
      : await microsoft.saveGeneration.execute({ actor: user, generationId: id as GenerationId });
  if (saved.ok) return { webUrl: saved.value.webUrl };
  return {
    error: messageFor(saved.error, locale),
    connect: 'code' in saved.error && saved.error.code === 'microsoft_not_connected',
  };
}

export async function disconnectMicrosoftAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().microsoft?.disconnect.execute({ actor: user });
  revalidatePath(`/${locale}/app/integrations`);
}
