'use server';

import { revalidatePath } from 'next/cache';
import type { ClassId, PortalLinkId, StudentId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface PortalFormState {
  readonly errors?: Readonly<Record<string, string>>;
  /** The address a link was just emailed to. */
  readonly sentTo?: string;
  /** A link just made, to copy now: it is never shown again. */
  readonly url?: string;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const pagePath = (locale: Locale, classId: string) =>
  `/${locale}/app/classes/${classId}/portal-links`;

function refs(data: FormData) {
  return {
    classId: text(data, 'classId') as ClassId,
    studentId: text(data, 'studentId') as StudentId,
    language: text(data, 'language'),
  };
}

/** Emails the family a new link; the address defaults to the roster's parent email. */
export async function emailPortalLinkAction(
  _state: PortalFormState,
  data: FormData,
): Promise<PortalFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const ref = refs(data);
  const sent = await getAppContainer().emailPortalLink.execute({
    actor: user,
    ...ref,
    to: text(data, 'to'),
  });
  if (!sent.ok) return { errors: formErrors(sent.error, locale) };
  revalidatePath(pagePath(locale, ref.classId));
  return { sentTo: sent.value.link.sentTo ?? '' };
}

/** A new link to copy and share; any earlier link for the family stops working. */
export async function issuePortalLinkAction(
  _state: PortalFormState,
  data: FormData,
): Promise<PortalFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const ref = refs(data);
  const issued = await getAppContainer().issuePortalLink.execute({ actor: user, ...ref });
  if (!issued.ok) return { errors: formErrors(issued.error, locale) };
  revalidatePath(pagePath(locale, ref.classId));
  return { url: issued.value.url };
}

export async function revokePortalLinkAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const classId = text(data, 'classId');
  await getAppContainer().revokePortalLink.execute({
    actor: user,
    classId: classId as ClassId,
    linkId: text(data, 'linkId') as PortalLinkId,
  });
  revalidatePath(pagePath(locale, classId));
}
