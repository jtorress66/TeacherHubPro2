'use server';

import { revalidatePath } from 'next/cache';
import type { GenerationId, PresentationId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { messageFor } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface CanvaFormState {
  /** The link to the new design, which works only for the teacher who sent it. */
  readonly editUrl?: string;
  readonly error?: string;
  /** True when the teacher needs to connect Canva in Settings first. */
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

/** Opens a presentation or AI-written material in the teacher's Canva account. */
export async function openInCanvaAction(
  _state: CanvaFormState,
  data: FormData,
): Promise<CanvaFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const canva = getAppContainer().canva;
  if (canva === null) return { error: messageFor({ code: 'not_found' }, locale) };
  const id = text(data, 'id');
  const sent =
    text(data, 'kind') === 'presentation'
      ? await canva.sendPresentation.execute({
          actor: user,
          presentationId: id as PresentationId,
        })
      : await canva.sendGeneration.execute({ actor: user, generationId: id as GenerationId });
  if (sent.ok) return { editUrl: sent.value.editUrl };
  return {
    error: messageFor(sent.error, locale),
    connect: 'code' in sent.error && sent.error.code === 'canva_not_connected',
  };
}

export async function disconnectCanvaAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().canva?.disconnect.execute({ actor: user });
  revalidatePath(`/${locale}/app/integrations`);
}
