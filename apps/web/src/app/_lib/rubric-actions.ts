'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  blankRubricDetails,
  rubricCriteriaRange,
  rubricLevelRange,
  type JobId,
  type RubricId,
} from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { pageLocale, parseRubricDraftForm, parseRubricGrid } from '../../server/rubric-forms.ts';
import { requireUser } from './auth.ts';

export interface RubricFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly saved?: boolean;
  /** Changes after each save so the form can show it again. */
  readonly version?: number;
}

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const rubricsPath = (locale: string) => `/${locale}/app/rubrics`;

/** Queues an AI draft of a rubric and opens its progress page. */
export async function requestRubricDraftAction(
  _state: RubricFormState,
  data: FormData,
): Promise<RubricFormState> {
  const { locale, input } = parseRubricDraftForm(data);
  const { user } = await requireUser(locale);
  const job = await getAppContainer().requestRubricDraft.execute({ actor: user, ...input });
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  redirect(`${rubricsPath(locale)}/jobs/${job.value.id}`);
}

/** Saves a new rubric, a blank grid or the teacher's finished draft, and opens the editor. */
export async function createRubricAction(
  _state: RubricFormState,
  data: FormData,
): Promise<RubricFormState> {
  const locale = pageLocale(data);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const jobId = text(data, 'jobId');
  // Capped just past the limit, so a huge number is refused by the domain, not allocated.
  const count = (name: string, range: { max: number; default: number }) => {
    const value = Number(text(data, name) || String(range.default));
    return Number.isInteger(value) ? Math.min(Math.max(value, 0), range.max + 1) : 0;
  };
  const created = await getAppContainer().createRubric.execute(
    jobId === ''
      ? {
          actor: user,
          details: blankRubricDetails({
            title: text(data, 'title'),
            criteriaCount: count('criteriaCount', rubricCriteriaRange),
            levelCount: count('levelCount', rubricLevelRange),
            levelLabel: (points) => t('rubrics.levelName', { points }),
            criterionName: (position) => t('rubrics.criterionName', { position }),
          }),
        }
      : { actor: user, jobId: jobId as JobId },
  );
  if (!created.ok) return { errors: formErrors(created.error, locale) };
  revalidatePath(rubricsPath(locale));
  redirect(`${rubricsPath(locale)}/${created.value.id}`);
}

/** Saves the editor: the title, subject, grade and the whole grid at once. */
export async function saveRubricAction(
  state: RubricFormState,
  data: FormData,
): Promise<RubricFormState> {
  const locale = pageLocale(data);
  const { user } = await requireUser(locale);
  const grid = parseRubricGrid(text(data, 'grid'));
  if (grid === null) return { errors: formErrors({ code: 'not_found' }, locale) };
  const rubricId = text(data, 'rubricId') as RubricId;
  const updated = await getAppContainer().updateRubric.execute({
    actor: user,
    rubricId,
    details: {
      title: text(data, 'title'),
      subject: text(data, 'subject'),
      grade: text(data, 'grade'),
      ...grid,
    },
  });
  if (!updated.ok) return { errors: formErrors(updated.error, locale) };
  revalidatePath(`${rubricsPath(locale)}/${rubricId}`);
  return { saved: true, version: (state.version ?? 0) + 1 };
}

export async function deleteRubricAction(data: FormData): Promise<void> {
  const locale = pageLocale(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deleteRubric.execute({
    actor: user,
    rubricId: text(data, 'rubricId') as RubricId,
  });
  revalidatePath(rubricsPath(locale));
  redirect(rubricsPath(locale));
}
