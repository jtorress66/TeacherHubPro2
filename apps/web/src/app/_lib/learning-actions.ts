'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ClassId, LearningPathId, PathDraft, StudentId } from '@thp/domain';
import type { CheckResult } from '@thp/application';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface LearningFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const learningPath = (locale: Locale) => `/${locale}/app/learning`;

/** Queues a draft for one student or each student of the class, then waits on the class page. */
export async function requestLearningPathsAction(
  _state: LearningFormState,
  data: FormData,
): Promise<LearningFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const studentId = text(data, 'studentId');
  const lessons = text(data, 'lessonCount');
  const jobs = await getAppContainer().requestLearningPath.execute({
    actor: user,
    classId: classId as ClassId,
    ...(studentId === '' ? {} : { studentId: studentId as StudentId }),
    subject: text(data, 'subject'),
    grade: text(data, 'grade'),
    language: text(data, 'language'),
    topic: text(data, 'topic'),
    esl: data.get('esl') === 'on',
    ...(lessons === '' ? {} : { lessonCount: Number(lessons) }),
  });
  if (!jobs.ok) return { errors: formErrors(jobs.error, locale) };
  const ids = jobs.value.map((job) => job.id).join(',');
  redirect(`${learningPath(locale)}?class=${encodeURIComponent(classId)}&jobs=${ids}`);
}

const check = z.object({
  prompt: z.string().max(400),
  options: z.array(z.string().max(400)).max(10),
  answer: z.number().int(),
});
const lesson = z.object({
  title: z.string().max(400),
  objective: z.string().max(400),
  minutes: z.number().int(),
  content: z.string().max(5000),
  checks: z.array(check).max(10),
});
const pathEdit = z.object({
  title: z.string().max(400),
  description: z.string().max(1000),
  lessons: z.array(lesson).max(10),
});

/** The teacher's edits to a draft; the domain checks every rule. */
export async function savePathAction(
  locale: Locale,
  pathId: string,
  input: PathDraft,
): Promise<LearningFormState> {
  const { user } = await requireUser(locale);
  const parsed = pathEdit.safeParse(input);
  if (!parsed.success)
    return { errors: formErrors({ code: 'invalid_format', field: 'form' }, locale) };
  const saved = await getAppContainer().updateLearningPath.execute({
    actor: user,
    pathId: pathId as LearningPathId,
    edit: parsed.data,
  });
  if (!saved.ok) return { errors: formErrors(saved.error, locale) };
  revalidatePath(`${learningPath(locale)}/${pathId}`);
  return { saved: true };
}

type PathCommand = 'assignLearningPath' | 'archiveLearningPath' | 'deleteLearningPath';

async function runOnPath(command: PathCommand, data: FormData): Promise<string> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const pathId = text(data, 'pathId') as LearningPathId;
  await getAppContainer()[command].execute({ actor: user, pathId });
  return locale;
}

export async function assignPathAction(data: FormData): Promise<void> {
  const locale = await runOnPath('assignLearningPath', data);
  redirect(`${learningPath(locale as Locale)}/${text(data, 'pathId')}`);
}

export async function archivePathAction(data: FormData): Promise<void> {
  const locale = await runOnPath('archiveLearningPath', data);
  redirect(`${learningPath(locale as Locale)}/${text(data, 'pathId')}`);
}

export async function deletePathAction(data: FormData): Promise<void> {
  const locale = await runOnPath('deleteLearningPath', data);
  redirect(`${learningPath(locale as Locale)}?class=${encodeURIComponent(text(data, 'classId'))}`);
}

// Students: their link's token is the only key.

export type CheckReply =
  { readonly ok: true; readonly result: CheckResult } | { readonly ok: false };

const checkInput = z.object({
  pathId: z.string().min(1).max(200),
  lesson: z.number().int().min(0).max(20),
  answers: z.array(z.number().int().nullable()).max(10),
});

export async function submitLessonCheckAction(
  token: string,
  input: z.input<typeof checkInput>,
): Promise<CheckReply> {
  const parsed = checkInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const result = await getAppContainer().submitLessonCheck.execute({
    token,
    pathId: parsed.data.pathId as LearningPathId,
    lesson: parsed.data.lesson,
    answers: parsed.data.answers,
  });
  return result.ok ? { ok: true, result: result.value } : { ok: false };
}
