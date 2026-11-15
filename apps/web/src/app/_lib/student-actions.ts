'use server';

import { revalidatePath } from 'next/cache';
import type { AssignmentId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { parseAnswersForm } from '../../server/assignment-forms.ts';
import { formErrors } from '../../server/error-messages.ts';
import { throttle } from './limits.ts';
import { passFor } from './lti-pass.ts';

export interface StudentFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly submitted?: boolean;
}

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

/**
 * A student hands in their answers from their personal link. No account: the link's token is
 * the key, and the submission is tied to the student behind it.
 */
export async function submitAnswersAction(
  _state: StudentFormState,
  data: FormData,
): Promise<StudentFormState> {
  const value = data.get('locale');
  const locale: Locale = isLocale(value) ? value : 'en';
  const token = text(data, 'token');
  const assignmentId = text(data, 'assignmentId');
  const limited = await throttle([['linkSubmit', token]]);
  if (limited !== null) return { errors: formErrors(limited, locale) };
  const submitted = await getAppContainer().submitAnswers.execute({
    token,
    assignmentId: assignmentId as AssignmentId,
    answers: parseAnswersForm(data),
  });
  if (!submitted.ok) return { errors: formErrors(submitted.error, locale) };
  revalidatePath(`/${locale}/s/${token}`, 'layout');
  return { submitted: true };
}

/**
 * A student hands in their answers to an assignment they opened from their course system: their
 * pass's cookie is the key, and the submission is tied to the roster student it names.
 */
export async function submitPassAnswersAction(
  _state: StudentFormState,
  data: FormData,
): Promise<StudentFormState> {
  const value = data.get('locale');
  const locale: Locale = isLocale(value) ? value : 'en';
  const assignmentId = text(data, 'assignmentId') as AssignmentId;
  const pass = await passFor({ kind: 'assignment', id: assignmentId });
  const limited = await throttle([['linkSubmit', pass === '' ? null : pass]]);
  if (limited !== null) return { errors: formErrors(limited, locale) };
  const submitted = await getAppContainer().submitAnswers.execute({
    pass,
    assignmentId,
    answers: parseAnswersForm(data),
  });
  if (!submitted.ok) return { errors: formErrors(submitted.error, locale) };
  revalidatePath(`/${locale}/lti/assignments/${assignmentId}`);
  return { submitted: true };
}
