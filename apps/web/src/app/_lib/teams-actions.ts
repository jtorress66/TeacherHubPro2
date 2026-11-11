'use server';

import { revalidatePath } from 'next/cache';
import type { AssignmentId, ClassId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { scheduledAtOf } from '../../server/schedule-form.ts';
import type { AssignmentFormState } from './assignment-actions.ts';
import { requireUser } from './auth.ts';
import { teacherTimeZone } from './time-zone.ts';

// Microsoft Teams: the same flows as Google Classroom, through the teacher's Microsoft account.

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const orNull = (value: string): string | null => (value === '' ? null : value);

const done = (
  state: AssignmentFormState,
  extra: Partial<AssignmentFormState> = {},
): AssignmentFormState => ({ saved: true, version: (state.version ?? 0) + 1, ...extra });

/** The Teams feature, or the "not found" answer when Teams is switched off. */
function teamsOf(locale: Locale) {
  const teams = getAppContainer().teams;
  return teams === null
    ? ({ ok: false, errors: formErrors({ code: 'not_found' }, locale) } as const)
    : ({ ok: true, teams } as const);
}

/** Adds a Teams class's students (first and last names) to a class. */
export async function importTeamsRosterAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const feature = teamsOf(locale);
  if (!feature.ok) return { errors: feature.errors };
  const classId = text(data, 'classId');
  const imported = await feature.teams.importRoster.execute({
    actor: user,
    classId: classId as ClassId,
    teamsClassId: text(data, 'teamsClassId'),
  });
  if (!imported.ok) return { errors: formErrors(imported.error, locale) };
  revalidatePath(`/${locale}/app/classes/${classId}`);
  return done(state, {
    message: createTranslator(locale)('classroom.imported', imported.value),
  });
}

/** Posts an assignment to a Teams class, linking to the app; due at the end of its due date. */
export async function shareToTeamsAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const feature = teamsOf(locale);
  if (!feature.ok) return { errors: feature.errors };
  const shared = await feature.teams.shareAssignment.execute({
    actor: user,
    classId: text(data, 'classId') as ClassId,
    assignmentId: text(data, 'assignmentId') as AssignmentId,
    teamsClassId: text(data, 'teamsClassId'),
    timeZone: await teacherTimeZone(),
  });
  if (!shared.ok) return { errors: formErrors(shared.error, locale) };
  return done(state, { url: shared.value.url });
}

/** Posts the teacher's own Word document to a Teams class, a copy for each student. */
export async function postWordToTeamsAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const feature = teamsOf(locale);
  if (!feature.ok) return { errors: feature.errors };
  const value = data.get('file');
  const file = value instanceof File && value.size > 0 ? value : null;
  if (file === null) return { errors: { file: createTranslator(locale)('attachments.noFile') } };
  const timeZone = await teacherTimeZone();
  const scheduledAt = scheduledAtOf(data, timeZone);
  if (!scheduledAt.ok) return { errors: formErrors(scheduledAt.error, locale) };
  const posted = await feature.teams.postWord.execute({
    actor: user,
    teamsClassId: text(data, 'teamsClassId'),
    title: text(data, 'title'),
    instructions: orNull(text(data, 'instructions')),
    dueDate: orNull(text(data, 'dueDate')),
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    timeZone,
    scheduledAt: scheduledAt.value,
  });
  if (!posted.ok) return { errors: formErrors(posted.error, locale) };
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  });
  return done(state, {
    url: posted.value.url,
    ...(scheduledAt.value === null ? {} : { scheduledFor: when.format(scheduledAt.value) }),
  });
}
