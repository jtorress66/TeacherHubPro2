'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { AssignmentId, ClassId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { nextStandards } from '../../server/assignment-standards-form.ts';
import { requireUser } from './auth.ts';

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/** Adds or removes an assignment's standards, then shows the page again with the outcome. */
export async function saveAssignmentStandardsAction(data: FormData): Promise<void> {
  const raw = data.get('locale');
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const assignmentId = text(data, 'assignmentId');
  const result = await getAppContainer().setAssignmentStandards.execute({
    actor: user,
    classId: classId as ClassId,
    assignmentId: assignmentId as AssignmentId,
    standards: nextStandards(data),
  });
  const page = `/${locale}/app/classes/${classId}/assignments/${assignmentId}`;
  revalidatePath(page);
  const outcome = result.ok ? 'standards=saved' : `standardsError=${result.error.code}`;
  redirect(`${page}?${outcome}#standards-heading`);
}
