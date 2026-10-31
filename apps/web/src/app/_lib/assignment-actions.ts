'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  AssignmentId,
  AttachmentId,
  ClassId,
  StudentId,
  StudentLinkId,
  SubmissionId,
} from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import type { IssuedLink } from '@thp/application';
import { getAppContainer } from '../../container.ts';
import { parseQuestionsJson, studentLinkUrl } from '../../server/assignment-forms.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface AssignmentFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
  readonly message?: string;
  /** Links just issued: shown once, never stored. */
  readonly links?: readonly { readonly name: string; readonly url: string }[];
  readonly url?: string;
  /** Changes after each success so the form can clear itself. */
  readonly version?: number;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const orNull = (value: string): string | null => (value === '' ? null : value);

const fileOf = (data: FormData, key: string): File | null => {
  const value = data.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

const done = (
  state: AssignmentFormState,
  extra: Partial<AssignmentFormState> = {},
): AssignmentFormState => ({
  saved: true,
  version: (state.version ?? 0) + 1,
  ...extra,
});

const classPath = (locale: Locale, classId: string) => `/${locale}/app/classes/${classId}`;
const assignmentPath = (locale: Locale, classId: string, assignmentId: string) =>
  `${classPath(locale, classId)}/assignments/${assignmentId}`;

/** The assignment a form is about, with the signed-in teacher. */
async function refOf(data: FormData) {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const assignmentId = text(data, 'assignmentId');
  return {
    locale,
    classId,
    assignmentId,
    ref: { actor: user, classId: classId as ClassId, assignmentId: assignmentId as AssignmentId },
  };
}

/** Saves the instructions and every question at once. */
export async function saveQuestionsAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  const questions = parseQuestionsJson(text(data, 'questions'));
  if (questions === null)
    return { errors: { form: createTranslator(locale)('questions.invalid') } };
  const app = getAppContainer();
  const instructions = await app.saveInstructions.execute({
    ...ref,
    instructions: orNull(text(data, 'instructions')),
  });
  if (!instructions.ok) return { errors: formErrors(instructions.error, locale) };
  const saved = await app.saveQuestions.execute({ ...ref, questions });
  if (!saved.ok) return { errors: formErrors(saved.error, locale) };
  const path = `${assignmentPath(locale, classId, assignmentId)}/questions`;
  revalidatePath(path);
  if (text(data, 'imported') === '1') redirect(`${path}?saved=1`);
  return done(state);
}

export async function uploadAttachmentAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  const file = fileOf(data, 'file');
  if (file === null) return { errors: { file: createTranslator(locale)('attachments.noFile') } };
  const uploaded = await getAppContainer().uploadAttachment.execute({
    ...ref,
    name: file.name,
    contentType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!uploaded.ok) {
    const errors = formErrors(uploaded.error, locale);
    return { errors: 'form' in errors ? errors : { file: Object.values(errors).join(' ') } };
  }
  revalidatePath(`${assignmentPath(locale, classId, assignmentId)}/questions`);
  return done(state);
}

export async function deleteAttachmentAction(data: FormData): Promise<void> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  await getAppContainer().deleteAttachment.execute({
    ...ref,
    attachmentId: text(data, 'attachmentId') as AttachmentId,
  });
  revalidatePath(`${assignmentPath(locale, classId, assignmentId)}/questions`);
}

/** Queues reading a PDF into questions and opens its progress page. */
export async function requestPdfImportAction(
  _state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  const file = fileOf(data, 'pdf');
  if (file === null) return { errors: { pdf: createTranslator(locale)('attachments.noFile') } };
  const job = await getAppContainer().requestPdfImport.execute({
    ...ref,
    pdf: new Uint8Array(await file.arrayBuffer()),
  });
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  redirect(`${assignmentPath(locale, classId, assignmentId)}/import/${job.value.id}`);
}

/** Queues AI suggestions for waiting written answers, then follows the job on the page. */
export async function requestAiGradingAction(
  _state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  const job = await getAppContainer().requestAiGrading.execute(ref);
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  if (job.value === null) return { message: createTranslator(locale)('grading.nothingToGrade') };
  redirect(`${assignmentPath(locale, classId, assignmentId)}/submissions?job=${job.value.id}`);
}

/** The teacher's decision on one submission: confirm the draft, or grade by hand. */
export async function gradeSubmissionAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, classId, assignmentId, ref } = await refOf(data);
  const app = getAppContainer();
  const scoreText = text(data, 'score');
  const score = scoreText === '' ? undefined : Number(scoreText);
  const decision = {
    ...ref,
    submissionId: text(data, 'submissionId') as SubmissionId,
    comment: orNull(text(data, 'comment')),
  };
  const result =
    text(data, 'intent') === 'confirm'
      ? await app.confirmGrade.execute({ ...decision, ...(score === undefined ? {} : { score }) })
      : await app.gradeByHand.execute({ ...decision, score: score ?? Number.NaN });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(`${assignmentPath(locale, classId, assignmentId)}/submissions`);
  revalidatePath(`${classPath(locale, classId)}/gradebook`);
  revalidatePath(`${classPath(locale, classId)}/report-cards`);
  return done(state);
}

export async function shareAssignmentAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const { locale, ref } = await refOf(data);
  const shared = await getAppContainer().shareAssignment.execute({
    ...ref,
    courseId: text(data, 'courseId'),
  });
  if (!shared.ok) return { errors: formErrors(shared.error, locale) };
  return done(state, { url: shared.value.url });
}

/** New links for students without one; the addresses are returned once to show and print. */
export async function issueLinksAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const app = getAppContainer();
  const studentId = text(data, 'studentId');
  const issued =
    studentId === ''
      ? await app.issueLinks.execute({ actor: user, classId: classId as ClassId })
      : await app.reissueLink.execute({
          actor: user,
          classId: classId as ClassId,
          studentId: studentId as StudentId,
        });
  if (!issued.ok) return { errors: formErrors(issued.error, locale) };
  const issuedLinks: readonly IssuedLink[] =
    'token' in issued.value ? [issued.value] : issued.value;
  const links = issuedLinks.map(({ student, token }) => ({
    name: `${student.firstName} ${student.lastName}`,
    url: studentLinkUrl(app.appUrl, locale, token),
  }));
  revalidatePath(`${classPath(locale, classId)}/student-links`);
  return done(state, { links });
}

export async function revokeLinkAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  await getAppContainer().revokeLink.execute({
    actor: user,
    classId: classId as ClassId,
    linkId: text(data, 'linkId') as StudentLinkId,
  });
  revalidatePath(`${classPath(locale, classId)}/student-links`);
}

export async function importRosterAction(
  state: AssignmentFormState,
  data: FormData,
): Promise<AssignmentFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const imported = await getAppContainer().importClassroomRoster.execute({
    actor: user,
    classId: classId as ClassId,
    courseId: text(data, 'courseId'),
  });
  if (!imported.ok) return { errors: formErrors(imported.error, locale) };
  revalidatePath(classPath(locale, classId));
  return done(state, {
    message: createTranslator(locale)('classroom.imported', imported.value),
  });
}

export async function disconnectClassroomAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().disconnectClassroom.execute({ actor: user });
  revalidatePath(`/${locale}/app/settings`);
}
