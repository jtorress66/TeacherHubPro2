'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CurriculumSource } from '@thp/application';
import type { CurriculumGuideId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { rejectedForm } from '../../server/error-messages.ts';
import { submittedValues, type SubmittedValues } from '../../server/form-values.ts';
import { requireUser } from './auth.ts';

export interface CurriculumFormState {
  readonly values?: SubmittedValues;
  readonly errors?: Readonly<Record<string, string>>;
  /** After a save: whether the guide is ready, or its file is still being read. */
  readonly saved?: 'ready' | 'reading';
  /** Changes after each save, so the form starts empty again. */
  readonly version?: number;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

const fileOf = (data: FormData): File | null => {
  const value = data.get('file');
  return value instanceof File && value.size > 0 ? value : null;
};

/** Saves a guide from a PDF or Word file, or from pasted text (one, not both). */
export async function uploadCurriculumAction(
  state: CurriculumFormState,
  data: FormData,
): Promise<CurriculumFormState> {
  const locale = localeOf(data);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const file = fileOf(data);
  const pasted = text(data, 'text');
  const refused = (form: string) => ({ errors: { form }, values: submittedValues(data) });
  if (file === null && pasted.trim() === '') return refused(t('curriculum.chooseOne'));
  if (file !== null && pasted.trim() !== '') return refused(t('curriculum.notBoth'));
  const source: CurriculumSource =
    file === null
      ? { kind: 'text', text: pasted }
      : { kind: 'file', fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };

  const saved = await getAppContainer().uploadCurriculumGuide.execute({
    actor: user,
    subject: text(data, 'subject'),
    grade: text(data, 'grade'),
    title: text(data, 'title'),
    source,
  });
  if (!saved.ok) {
    const { error } = saved;
    if ('field' in error && error.field === 'file' && error.code === 'not_allowed') {
      return { errors: { file: t('curriculum.fileKinds') }, values: submittedValues(data) };
    }
    return rejectedForm(error, locale, data);
  }
  revalidatePath(`/${locale}/app/curriculum`);
  return {
    saved: saved.value.status === 'reading' ? 'reading' : 'ready',
    version: (state.version ?? 0) + 1,
  };
}

/** Removes a guide, then shows the list again with a note. */
export async function removeCurriculumAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const removed = await getAppContainer().removeCurriculumGuide.execute({
    actor: user,
    guideId: text(data, 'guideId') as CurriculumGuideId,
  });
  revalidatePath(`/${locale}/app/curriculum`);
  redirect(`/${locale}/app/curriculum${removed.ok ? '?removed=1' : ''}`);
}
