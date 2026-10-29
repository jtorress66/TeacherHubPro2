'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ClassId, SemesterId, StudentId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { parseForm, type FieldErrors } from '../../server/forms.ts';
import { importErrorMessages } from '../../server/import-messages.ts';
import { classForm, semesterForm, studentForm, toClassChanges } from '../../server/roster-forms.ts';
import { requireUser } from './auth.ts';

export interface RosterFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly messages?: readonly string[];
  readonly saved?: boolean;
  readonly imported?: number;
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

const fieldMessages = (errors: FieldErrors, locale: Locale): RosterFormState => {
  const t = createTranslator(locale);
  return {
    errors: Object.fromEntries(
      Object.entries(errors).map(([field, code]) => [field, t(`errors.${code}`)]),
    ),
  };
};

const classPage = (locale: Locale, classId: string) => `/${locale}/app/classes/${classId}`;

export async function createClassAction(
  _state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(classForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { user } = await requireUser(form.value.locale);
  const result = await getAppContainer().createClass.execute({
    actor: user,
    details: toClassChanges(form.value),
  });
  if (!result.ok) return { errors: formErrors(result.error, form.value.locale) };
  // The dashboard's setup checklist counts classes.
  revalidatePath(`/${form.value.locale}/app`);
  redirect(classPage(form.value.locale, result.value.id));
}

export async function updateClassAction(
  _state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(classForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { user } = await requireUser(form.value.locale);
  const result = await getAppContainer().updateClass.execute({
    actor: user,
    classId: text(data, 'classId') as ClassId,
    details: toClassChanges(form.value),
  });
  if (!result.ok) return { errors: formErrors(result.error, form.value.locale) };
  revalidatePath(classPage(form.value.locale, result.value.id));
  return { saved: true };
}

export async function archiveClassAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().archiveClass.execute({
    actor: user,
    classId: text(data, 'classId') as ClassId,
  });
  redirect(`/${locale}/app/classes`);
}

export async function restoreClassAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  await getAppContainer().restoreClass.execute({ actor: user, classId: classId as ClassId });
  revalidatePath(`/${locale}/app/classes`);
  revalidatePath(classPage(locale, classId));
  redirect(classPage(locale, classId));
}

export async function addStudentAction(
  state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(studentForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, ...details } = form.value;
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const result = await getAppContainer().addStudent.execute({
    actor: user,
    classId: classId as ClassId,
    details,
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(classPage(locale, classId));
  return { saved: true, version: (state.version ?? 0) + 1 };
}

export async function updateStudentAction(
  _state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(studentForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, ...details } = form.value;
  const { user } = await requireUser(locale);
  const result = await getAppContainer().updateStudent.execute({
    actor: user,
    studentId: text(data, 'studentId') as StudentId,
    details,
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  // Refresh the roster before going back to it, so it shows the change.
  revalidatePath(classPage(locale, result.value.classId));
  redirect(classPage(locale, result.value.classId));
}

export async function deleteStudentAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  await getAppContainer().deleteStudent.execute({
    actor: user,
    studentId: text(data, 'studentId') as StudentId,
  });
  revalidatePath(classPage(locale, classId));
}

export async function importStudentsAction(
  state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const file = data.get('file');
  const csv = file instanceof File ? await file.text() : '';
  const classId = text(data, 'classId');
  const result = await getAppContainer().importStudents.execute({
    actor: user,
    classId: classId as ClassId,
    csv,
  });
  if (!result.ok) return { messages: importErrorMessages(result.error, locale) };
  revalidatePath(classPage(locale, classId));
  return { imported: result.value.imported, version: (state.version ?? 0) + 1 };
}

export async function createSemesterAction(
  _state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(semesterForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, makeActive, ...details } = form.value;
  const { user } = await requireUser(locale);
  const result = await getAppContainer().createSemester.execute({
    actor: user,
    details,
    makeActive,
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(`/${locale}/app/semesters`);
  return { saved: true };
}

export async function updateSemesterAction(
  _state: RosterFormState,
  data: FormData,
): Promise<RosterFormState> {
  const form = parseForm(semesterForm, data);
  if (!form.ok) return fieldMessages(form.error, localeOf(data));
  const { locale, name, startDate, endDate, schoolYear } = form.value;
  const { user } = await requireUser(locale);
  const result = await getAppContainer().updateSemester.execute({
    actor: user,
    semesterId: text(data, 'semesterId') as SemesterId,
    details: { name, startDate, endDate, schoolYear },
  });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(`/${locale}/app/semesters`);
  redirect(`/${locale}/app/semesters`);
}

export async function setActiveSemesterAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().setActiveSemester.execute({
    actor: user,
    semesterId: text(data, 'semesterId') as SemesterId,
  });
  revalidatePath(`/${locale}/app/semesters`);
}

export async function deleteSemesterAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const result = await getAppContainer().deleteSemester.execute({
    actor: user,
    semesterId: text(data, 'semesterId') as SemesterId,
  });
  revalidatePath(`/${locale}/app/semesters`);
  redirect(`/${locale}/app/semesters${result.ok ? '' : `?error=${result.error.code}`}`);
}

export async function dismissOnboardingAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().dismissOnboarding.execute({ actor: user });
  revalidatePath(`/${locale}/app`);
}
