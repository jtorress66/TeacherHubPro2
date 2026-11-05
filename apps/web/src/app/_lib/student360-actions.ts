'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ClassId, StudentId, StudentNoteId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';
import { teacherTimeZone } from './time-zone.ts';

export interface Student360FormState {
  readonly errors?: Readonly<Record<string, string>>;
  /** Changes after each success so the form can clear itself. */
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

/** The student a form is about, with the signed-in teacher. */
async function refOf(data: FormData) {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const studentId = text(data, 'studentId');
  return {
    locale,
    path: `/${locale}/app/classes/${classId}/students/${studentId}`,
    ref: { actor: user, classId: classId as ClassId, studentId: studentId as StudentId },
  };
}

export async function addStudentNoteAction(
  state: Student360FormState,
  data: FormData,
): Promise<Student360FormState> {
  const { locale, path, ref } = await refOf(data);
  const added = await getAppContainer().addStudentNote.execute({
    ...ref,
    text: text(data, 'text'),
  });
  if (!added.ok) return { errors: formErrors(added.error, locale) };
  revalidatePath(path);
  return { version: (state.version ?? 0) + 1 };
}

export async function deleteStudentNoteAction(data: FormData): Promise<void> {
  const { path, ref } = await refOf(data);
  await getAppContainer().deleteStudentNote.execute({
    ...ref,
    noteId: text(data, 'noteId') as StudentNoteId,
  });
  revalidatePath(path);
}

/** Starts the AI insight, then follows the job on the student's page. */
export async function requestStudentInsightAction(
  _state: Student360FormState,
  data: FormData,
): Promise<Student360FormState> {
  const { locale, path, ref } = await refOf(data);
  const job = await getAppContainer().requestStudentInsight.execute({
    ...ref,
    timeZone: await teacherTimeZone(),
  });
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  redirect(`${path}?job=${job.value.id}`);
}
