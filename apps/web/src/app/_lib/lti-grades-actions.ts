'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { AssignmentId, ClassId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { gradeSendReturnPath, readLtiCourseOption } from '../../server/lti.ts';
import { requireUser } from './auth.ts';

// Grades to a course system: a teacher sends an assignment's confirmed grades to a course it is
// placed in. The sending is a job; the page they came from shows its progress, then what went.

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const sendForm = z.object({
  classId: z.string().trim().min(1),
  assignmentId: z.string().trim().min(1),
  ltiCourse: z.string().trim().min(1),
});

/** Starts sending the grades, then goes back to the page, which follows the job. */
export async function sendLtiGradesAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const back = gradeSendReturnPath(locale, data.get('returnTo'));
  const lti = getAppContainer().lti;
  const form = sendForm.safeParse(Object.fromEntries(data.entries()));
  const course = form.success ? readLtiCourseOption(form.data.ltiCourse) : null;
  if (lti === null || !form.success || course === null) redirect(`${back}?ltiGrades=failed`);
  const started = await lti.sendGrades.execute({
    actor: user,
    classId: form.data.classId as ClassId,
    assignmentId: form.data.assignmentId as AssignmentId,
    platformId: course.platformId,
    contextId: course.contextId,
  });
  if (!started.ok) {
    const reason = 'code' in started.error && started.error.code === 'course_system_refused';
    redirect(`${back}?ltiGrades=${reason ? 'refused' : 'failed'}`);
  }
  redirect(`${back}?ltiJob=${started.value.jobId}`);
}
