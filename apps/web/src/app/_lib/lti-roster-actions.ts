'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ClassId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { readLtiCourseOption } from '../../server/lti.ts';
import type { AssignmentFormState } from './assignment-actions.ts';
import { requireUser } from './auth.ts';

// LTI class lists: a teacher imports the students of a course they opened TeacherHubPro from.

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const importForm = z.object({
  classId: z.string().trim().min(1),
  ltiCourse: z.string().trim().min(1),
});

/** Adds the chosen course's active learners (first and last names) to a class. */
export async function importLtiRosterAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const lti = getAppContainer().lti;
  const form = importForm.safeParse({
    classId: data.get('classId'),
    ltiCourse: data.get('ltiCourse'),
  });
  const course = form.success ? readLtiCourseOption(form.data.ltiCourse) : null;
  if (lti === null || !form.success || course === null) {
    return { errors: formErrors({ code: 'not_found' }, locale) };
  }
  const { classId } = form.data;
  const imported = await lti.importRoster.execute({
    actor: user,
    classId: classId as ClassId,
    platformId: course.platformId,
    contextId: course.contextId,
  });
  if (!imported.ok) return { errors: formErrors(imported.error, locale) };
  revalidatePath(`/${locale}/app/classes/${classId}`);
  return {
    saved: true,
    version: (state.version ?? 0) + 1,
    message: createTranslator(locale)('lti.imported', { ...imported.value }),
  };
}
