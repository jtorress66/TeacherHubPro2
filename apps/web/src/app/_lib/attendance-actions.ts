'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { parseAttendanceForm } from '../../server/attendance-forms.ts';
import {
  attendanceErrorMessage,
  attendanceFieldMessages,
} from '../../server/attendance-messages.ts';
import { requireUser } from './auth.ts';

export interface AttendanceFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly done?: 'saved' | 'submitted';
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

const attendancePage = (locale: Locale, classId: string, date: string) =>
  `/${locale}/app/classes/${classId}/attendance?date=${encodeURIComponent(date)}`;

function refresh(locale: Locale, classId: string): void {
  revalidatePath(`/${locale}/app/classes/${classId}/attendance`);
  revalidatePath(`/${locale}/app/classes/${classId}/attendance/report`);
  revalidatePath(`/${locale}/app/attendance`);
}

/** Save or Submit on the attendance sheet (the button pressed sets `intent`). */
export async function saveAttendanceAction(
  _state: AttendanceFormState,
  data: FormData,
): Promise<AttendanceFormState> {
  const form = parseAttendanceForm(data);
  if (!form.ok) return { errors: attendanceFieldMessages(form.error, localeOf(data)) };
  const { locale, classId, date, intent, marks } = form.value;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const useCase = intent === 'submit' ? app.submitAttendance : app.saveAttendance;
  const result = await useCase.execute({ actor: user, classId: classId as ClassId, date, marks });
  if (!result.ok) return { errors: { form: attendanceErrorMessage(result.error, locale) } };
  refresh(locale, classId);
  return { done: intent === 'submit' ? 'submitted' : 'saved' };
}

export async function reopenAttendanceAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const date = text(data, 'date');
  await getAppContainer().reopenAttendance.execute({
    actor: user,
    classId: classId as ClassId,
    date,
  });
  refresh(locale, classId);
  redirect(attendancePage(locale, classId, date));
}
