'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { GenerationId, JobId, PresentationId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import {
  parseContentForm,
  parsePresentationRequestForm,
  parseSlides,
  parseSubPacketForm,
} from '../../server/assistant-forms.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface AssistantFormState {
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

const assistantPath = (locale: Locale) => `/${locale}/app/assistant`;
const presentationsPath = (locale: Locale) => `/${locale}/app/presentations`;

const done = (state: AssistantFormState): AssistantFormState => ({
  saved: true,
  version: (state.version ?? 0) + 1,
});

/** Queues the assistant's writing and opens its progress page. */
export async function requestGenerationAction(
  _state: AssistantFormState,
  data: FormData,
): Promise<AssistantFormState> {
  const { locale, input } = parseContentForm(data);
  const { user } = await requireUser(locale);
  const job = await getAppContainer().requestGeneration.execute({ actor: user, ...input });
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  redirect(`${assistantPath(locale)}/jobs/${job.value.id}`);
}

export async function deleteGenerationAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deleteGeneration.execute({
    actor: user,
    generationId: text(data, 'generationId') as GenerationId,
  });
  revalidatePath(assistantPath(locale));
  redirect(assistantPath(locale));
}

/** Queues a slide draft and opens its progress page. */
export async function requestPresentationDraftAction(
  _state: AssistantFormState,
  data: FormData,
): Promise<AssistantFormState> {
  const { locale, input } = parsePresentationRequestForm(data);
  const { user } = await requireUser(locale);
  const job = await getAppContainer().requestPresentationDraft.execute({ actor: user, ...input });
  if (!job.ok) return { errors: formErrors(job.error, locale) };
  redirect(`${presentationsPath(locale)}/jobs/${job.value.id}`);
}

/** Saves a new presentation, blank or from the teacher's finished draft, and opens the editor. */
export async function createPresentationAction(
  _state: AssistantFormState,
  data: FormData,
): Promise<AssistantFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const jobId = text(data, 'jobId');
  const created = await getAppContainer().createPresentation.execute(
    jobId === ''
      ? { actor: user, name: text(data, 'name'), theme: text(data, 'theme') }
      : { actor: user, jobId: jobId as JobId },
  );
  if (!created.ok) return { errors: formErrors(created.error, locale) };
  revalidatePath(presentationsPath(locale));
  redirect(`${presentationsPath(locale)}/${created.value.id}`);
}

/** Saves the editor: the name, theme and every slide at once. */
export async function savePresentationAction(
  state: AssistantFormState,
  data: FormData,
): Promise<AssistantFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const slides = parseSlides(text(data, 'slides'));
  if (slides === null) return { errors: formErrors({ code: 'not_found' }, locale) };
  const presentationId = text(data, 'presentationId') as PresentationId;
  const updated = await getAppContainer().updatePresentation.execute({
    actor: user,
    presentationId,
    changes: { name: text(data, 'name'), theme: text(data, 'theme'), slides },
  });
  if (!updated.ok) return { errors: formErrors(updated.error, locale) };
  revalidatePath(`${presentationsPath(locale)}/${presentationId}`);
  return done(state);
}

export async function deletePresentationAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  await getAppContainer().deletePresentation.execute({
    actor: user,
    presentationId: text(data, 'presentationId') as PresentationId,
  });
  revalidatePath(presentationsPath(locale));
  redirect(presentationsPath(locale));
}

/** Saves the notes a teacher writes for substitutes. */
export async function saveSubPacketAction(
  state: AssistantFormState,
  data: FormData,
): Promise<AssistantFormState> {
  const { locale, classId, details } = parseSubPacketForm(data);
  const { user } = await requireUser(locale);
  const saved = await getAppContainer().saveSubPacket.execute({ actor: user, classId, details });
  if (!saved.ok) return { errors: formErrors(saved.error, locale) };
  revalidatePath(`/${locale}/app/classes/${classId}/sub-packet`);
  return done(state);
}
