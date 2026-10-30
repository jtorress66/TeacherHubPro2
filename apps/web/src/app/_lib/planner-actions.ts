'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ClassId, LessonPlanId, PlanFolderId, PlanTemplateId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { parsePlanForm } from '../../server/plan-forms.ts';
import { planErrors } from '../../server/planner-messages.ts';
import { requireUser } from './auth.ts';

export interface PlannerFormState {
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
  return typeof value === 'string' ? value.trim() : '';
};

const plansPath = (locale: Locale) => `/${locale}/app/plans`;

const done = (state: PlannerFormState): PlannerFormState => ({
  saved: true,
  version: (state.version ?? 0) + 1,
});

/** Saves the editor: a new plan opens at its own address, an existing one stays on the page. */
export async function savePlanAction(
  state: PlannerFormState,
  data: FormData,
): Promise<PlannerFormState> {
  const form = parsePlanForm(data);
  const { user } = await requireUser(form.locale);
  const app = getAppContainer();
  const content = {
    title: form.title,
    classId: form.classId,
    folderId: form.folderId,
    body: form.body,
  };
  const result =
    form.planId === ''
      ? await app.createPlan.execute({ actor: user, ...content })
      : await app.updatePlan.execute({
          actor: user,
          planId: form.planId as LessonPlanId,
          ...content,
        });
  if (!result.ok) return { errors: planErrors(result.error, form.locale) };
  revalidatePath(plansPath(form.locale));
  if (form.planId === '') redirect(`${plansPath(form.locale)}/${result.value.id}?saved=1`);
  revalidatePath(`${plansPath(form.locale)}/${result.value.id}`);
  return done(state);
}

/** Duplicate, move, save as template or delete one plan, by the button's `intent`. */
export async function planCommandAction(
  state: PlannerFormState,
  data: FormData,
): Promise<PlannerFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const input = { actor: user, planId: text(data, 'planId') as LessonPlanId };
  const intent = text(data, 'intent');

  if (intent === 'duplicate') {
    const copy = await app.duplicatePlan.execute({ ...input, start: text(data, 'start') });
    if (!copy.ok) return { errors: planErrors(copy.error, locale) };
    revalidatePath(plansPath(locale));
    redirect(`${plansPath(locale)}/${copy.value.id}`);
  }
  if (intent === 'move') {
    const folderId = text(data, 'folderId');
    const moved = await app.movePlan.execute({
      ...input,
      folderId: folderId === '' ? null : (folderId as PlanFolderId),
    });
    if (!moved.ok) return { errors: formErrors(moved.error, locale) };
  } else if (intent === 'template') {
    const saved = await app.saveAsTemplate.execute({ ...input, name: text(data, 'name') });
    if (!saved.ok) return { errors: formErrors(saved.error, locale) };
    revalidatePath(`/${locale}/app/templates`);
  } else {
    const deleted = await app.deletePlan.execute(input);
    if (!deleted.ok) return { errors: formErrors(deleted.error, locale) };
    revalidatePath(plansPath(locale));
    redirect(plansPath(locale));
  }
  revalidatePath(plansPath(locale));
  revalidatePath(`${plansPath(locale)}/${input.planId}`);
  return done(state);
}

/** Create, rename and recolour, or delete a folder, by the button's `intent`. */
export async function folderAction(
  state: PlannerFormState,
  data: FormData,
): Promise<PlannerFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const folderId = text(data, 'folderId') as PlanFolderId;
  const details = { name: text(data, 'name'), color: text(data, 'color') || 'indigo' };
  const intent = text(data, 'intent');
  const result =
    intent === 'delete'
      ? await app.deleteFolder.execute({ actor: user, folderId })
      : intent === 'update'
        ? await app.updateFolder.execute({ actor: user, folderId, ...details })
        : await app.createFolder.execute({ actor: user, ...details });
  if (!result.ok) return { errors: formErrors(result.error, locale) };
  revalidatePath(plansPath(locale));
  return done(state);
}

export async function deleteTemplateAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deleteTemplate.execute({
    actor: user,
    templateId: text(data, 'templateId') as PlanTemplateId,
  });
  revalidatePath(`/${locale}/app/templates`);
}

/** Queues an AI draft and opens its progress page. */
export async function requestDraftAction(
  _state: PlannerFormState,
  data: FormData,
): Promise<PlannerFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  const minutes = text(data, 'durationMinutes');
  const job = await getAppContainer().requestLessonPlanDraft.execute({
    actor: user,
    kind: text(data, 'kind'),
    subject: text(data, 'subject') || null,
    grade: text(data, 'grade'),
    topic: text(data, 'topic'),
    difficulty: text(data, 'difficulty') || 'medium',
    durationMinutes: minutes === '' ? 45 : Number(minutes),
    language: locale,
    instructions: text(data, 'instructions') || null,
    start: text(data, 'start'),
    classId: classId === '' ? null : (classId as ClassId),
  });
  if (!job.ok) return { errors: planErrors(job.error, locale) };
  redirect(`${plansPath(locale)}/draft/${job.value.id}`);
}
