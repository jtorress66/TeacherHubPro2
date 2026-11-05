'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { PrepBatchId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { parseEmailForm, parsePrepForm, prepEmailTemplate } from '../../server/prep-forms.ts';
import { requireUser } from './auth.ts';

export interface PrepFormState {
  readonly errors?: Readonly<Record<string, string>>;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
};

const prepPath = (locale: Locale) => `/${locale}/app/prep`;

/** The batch a form is about, with the signed-in teacher. */
async function refOf(data: FormData) {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const batchId = text(data, 'batchId') as PrepBatchId;
  return { locale, path: `${prepPath(locale)}/${batchId}`, ref: { actor: user, batchId } };
}

/** Email field errors sit under the email's own fields, not the subject picker. */
const emailFields: Readonly<Record<string, string>> = {
  subject: 'emailSubject',
  body: 'emailBody',
};

/** Starts a weekly prep and opens its progress page. */
export async function startPrepAction(
  _state: PrepFormState,
  data: FormData,
): Promise<PrepFormState> {
  const { locale, input } = parsePrepForm(data);
  const { user } = await requireUser(locale);
  const container = getAppContainer();
  const classes = await container.listClasses.execute({ actor: user });
  const className = classes.find((cls) => cls.id === input.classId)?.name ?? '';
  const language = isLocale(input.language) ? input.language : locale;
  const started = await container.startPrepBatch.execute({
    actor: user,
    request: {
      ...input,
      emailTemplate: prepEmailTemplate(language, { className, teacherName: user.name }),
    },
  });
  if (!started.ok) return { errors: formErrors(started.error, locale) };
  revalidatePath(prepPath(locale));
  redirect(`${prepPath(locale)}/${started.value.id}`);
}

/** Picks the drafting up again after a stall, or from the plan after a failure. */
export async function resumePrepAction(data: FormData): Promise<void> {
  const { path, ref } = await refOf(data);
  await getAppContainer().resumePrepBatch.execute(ref);
  revalidatePath(path);
  redirect(path);
}

/** Keeps the ticked drafts and the edited email, then publishes them. */
export async function publishPrepAction(
  _state: PrepFormState,
  data: FormData,
): Promise<PrepFormState> {
  const { locale, path, ref } = await refOf(data);
  const container = getAppContainer();
  const selection = await container.updatePrepSelection.execute({
    ...ref,
    ...parseEmailForm(data),
  });
  if (!selection.ok) {
    const errors = formErrors(selection.error, locale);
    return {
      errors: Object.fromEntries(
        Object.entries(errors).map(([field, message]) => [emailFields[field] ?? field, message]),
      ),
    };
  }
  const published = await container.publishPrepBatch.execute(ref);
  if (!published.ok) return { errors: formErrors(published.error, locale) };
  revalidatePath(path);
  redirect(path);
}

export async function deletePrepAction(data: FormData): Promise<void> {
  const { locale, ref } = await refOf(data);
  await getAppContainer().deletePrepBatch.execute(ref);
  revalidatePath(prepPath(locale));
  redirect(prepPath(locale));
}
