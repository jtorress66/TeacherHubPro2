'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AssignmentId, ClassId, StudentId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import {
  parseAssignmentForm,
  parseCategoryForm,
  parseGradeForm,
} from '../../server/grade-forms.ts';
import { gradeEntryMessages, gradeFieldMessages } from '../../server/gradebook-messages.ts';
import { requireUser } from './auth.ts';

export interface GradebookFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
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

const classPath = (locale: Locale, classId: string) => `/${locale}/app/classes/${classId}`;
const gradebookPath = (locale: Locale, classId: string) =>
  `${classPath(locale, classId)}/gradebook`;

/** Every page that shows a class's grades. */
function refresh(locale: Locale, classId: string): void {
  const base = classPath(locale, classId);
  revalidatePath(`${base}/gradebook`);
  revalidatePath(`${base}/gradebook/report`);
  revalidatePath(`${base}/report-cards`);
  revalidatePath(`${base}/assignments/[assignmentId]`, 'page');
}

const done = (state: GradebookFormState): GradebookFormState => ({
  saved: true,
  version: (state.version ?? 0) + 1,
});

export async function addCategoryAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const form = parseCategoryForm(data);
  const { user } = await requireUser(form.locale);
  const result = await getAppContainer().addGradeCategory.execute({
    actor: user,
    classId: form.classId as ClassId,
    details: form.details,
  });
  if (!result.ok) return { errors: formErrors(result.error, form.locale) };
  refresh(form.locale, form.classId);
  return done(state);
}

export async function updateCategoryAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const form = parseCategoryForm(data);
  const { user } = await requireUser(form.locale);
  const app = getAppContainer();
  const input = { actor: user, classId: form.classId as ClassId, categoryId: form.categoryId };
  const result =
    text(data, 'intent') === 'delete'
      ? await app.deleteGradeCategory.execute(input)
      : await app.updateGradeCategory.execute({ ...input, details: form.details });
  if (!result.ok) return { errors: formErrors(result.error, form.locale) };
  refresh(form.locale, form.classId);
  return done(state);
}

/** Homework, quiz, test and project, named in the teacher's language. */
export async function addStandardCategoriesAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  await getAppContainer().addStandardCategories.execute({
    actor: user,
    classId: classId as ClassId,
    names: {
      homework: t('gradebook.standard_homework'),
      quiz: t('gradebook.standard_quiz'),
      test: t('gradebook.standard_test'),
      project: t('gradebook.standard_project'),
    },
  });
  refresh(locale, classId);
}

/** Creates an assignment, or saves changes to one when `assignmentId` is set. */
export async function saveAssignmentAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const form = parseAssignmentForm(data);
  const { user } = await requireUser(form.locale);
  const app = getAppContainer();
  const input = { actor: user, classId: form.classId as ClassId, details: form.details };
  const result =
    form.assignmentId === ''
      ? await app.createAssignment.execute(input)
      : await app.updateAssignment.execute({
          ...input,
          assignmentId: form.assignmentId as AssignmentId,
        });
  if (!result.ok) return { errors: gradeEntryMessages(result.error, form.locale) };
  refresh(form.locale, form.classId);
  return done(state);
}

export async function deleteAssignmentAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const result = await getAppContainer().deleteAssignment.execute({
    actor: user,
    classId: classId as ClassId,
    assignmentId: text(data, 'assignmentId') as AssignmentId,
  });
  refresh(locale, classId);
  if (result.ok) redirect(gradebookPath(locale, classId));
}

export async function saveGradesAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const form = parseGradeForm(data);
  if (!form.ok) return { errors: gradeFieldMessages(form.error, localeOf(data)) };
  const { locale, classId, assignmentId, rows } = form.value;
  const { user } = await requireUser(locale);
  const result = await getAppContainer().saveGrades.execute({
    actor: user,
    classId: classId as ClassId,
    assignmentId: assignmentId as AssignmentId,
    rows,
  });
  if (!result.ok) return { errors: gradeEntryMessages(result.error, locale) };
  refresh(locale, classId);
  return done(state);
}

export async function saveCommentAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const result = await getAppContainer().saveReportCardComment.execute({
    actor: user,
    classId: classId as ClassId,
    studentId: text(data, 'studentId') as StudentId,
    text: text(data, 'comment'),
  });
  if (!result.ok) return { errors: gradeEntryMessages(result.error, locale) };
  refresh(locale, classId);
  return done(state);
}

export async function uploadLogoAction(
  state: GradebookFormState,
  data: FormData,
): Promise<GradebookFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const file = data.get('logo');
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
  const result = await getAppContainer().uploadSchoolLogo.execute({ actor: user, bytes });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(`/${locale}/app/settings`);
  return done(state);
}

export async function removeLogoAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().removeSchoolLogo.execute({ actor: user });
  revalidatePath(`/${locale}/app/settings`);
}
