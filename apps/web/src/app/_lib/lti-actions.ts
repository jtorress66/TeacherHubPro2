'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import type { LtiPlatformId } from '@thp/domain';
import { createTranslator, isLocale, type Locale } from '@thp/i18n';
import { getAppContainer, type LtiFeature } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import {
  afterLinkPath,
  LTI_LINK_COOKIE,
  LTI_PLACE_COOKIE,
  ltiPlaceErrorKey,
  ltiProblemFor,
  readPlacedItems,
} from '../../server/lti.ts';
import { requireUser, takeSessionCookie } from './auth.ts';

export interface LtiFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly notice?: string;
  /** Changes after each success so the form can clear itself. */
  readonly version?: number;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const field = z
  .string()
  .optional()
  .transform((value) => value ?? '');

const platformForm = z.object({
  name: field,
  issuer: field,
  clientId: field,
  deploymentIds: field,
  authLoginUrl: field,
  authTokenUrl: field,
  jwksUrl: field,
});

const ltiOrNotFound = (): LtiFeature => {
  const lti = getAppContainer().lti;
  if (lti === null) notFound();
  return lti;
};

const schoolSystemsPath = (locale: Locale) => `/${locale}/app/admin/school-systems`;

/** A school admin registers their course system; each field's problem shows under it. */
export async function registerLtiPlatformAction(
  state: LtiFormState,
  data: FormData,
): Promise<LtiFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const details = platformForm.parse(Object.fromEntries(data.entries()));
  const registered = await ltiOrNotFound().register.execute({ actor: user, details });
  if (!registered.ok) return { errors: formErrors(registered.error, locale) };
  revalidatePath(schoolSystemsPath(locale));
  return {
    notice: createTranslator(locale)('lti.added'),
    version: (state.version ?? 0) + 1,
  };
}

/** Removes one of the school's course systems. */
export async function removeLtiPlatformAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const platformId = data.get('platformId');
  if (typeof platformId === 'string') {
    await ltiOrNotFound().remove.execute({
      actor: user,
      platformId: platformId as LtiPlatformId,
    });
  }
  revalidatePath(schoolSystemsPath(locale));
}

/**
 * Links the signed-in teacher to the course system user waiting in the link cookie, then goes on to
 * the picker when the launch was a course's "Add content".
 */
export async function linkLtiAccountAction(
  _state: LtiFormState,
  data: FormData,
): Promise<LtiFormState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const store = await cookies();
  const ticket = store.get(LTI_LINK_COOKIE)?.value ?? '';
  const linked = await ltiOrNotFound().link.execute({ actor: user, ticket });
  if (!linked.ok) {
    const problem = ltiProblemFor(linked.error.code);
    return { errors: { form: createTranslator(locale)(`lti.problem_${problem}`) } };
  }
  store.delete(LTI_LINK_COOKIE);
  redirect(afterLinkPath(locale, store.has(LTI_PLACE_COOKIE)));
}

/** Forgets the waiting link (and any waiting choice) and goes to the app (or the login page). */
export async function cancelLtiLinkAction(data: FormData): Promise<void> {
  const store = await cookies();
  store.delete(LTI_LINK_COOKIE);
  store.delete(LTI_PLACE_COOKIE);
  redirect(`/${localeOf(data)}/app`);
}

export interface LtiPlaceState {
  readonly error?: string;
  /** The signed answer to post back to the course system, once the items are chosen. */
  readonly placement?: { readonly returnUrl: string; readonly jwt: string };
}

/**
 * Adds the chosen assignments and games to the course waiting in the choice cookie: the answer is
 * signed here, and the page posts it back to the course system. The cookie is left to expire:
 * changing cookies in an action would render the picker again, under the page posting back.
 */
export async function placeLtiContentAction(
  _state: LtiPlaceState,
  data: FormData,
): Promise<LtiPlaceState> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  const placed = await ltiOrNotFound().place.execute({
    actor: user,
    ticket: (await cookies()).get(LTI_PLACE_COOKIE)?.value ?? '',
    items: readPlacedItems(data.getAll('item')),
  });
  if (!placed.ok) return { error: createTranslator(locale)(ltiPlaceErrorKey(placed.error.code)) };
  return { placement: placed.value };
}

/** Logs out from the linking page, so someone else can log in and link their own account. */
export async function logOutForLtiLinkAction(data: FormData): Promise<void> {
  const token = await takeSessionCookie();
  if (token !== undefined) await getAppContainer().logOut.execute(token);
  redirect(`/${localeOf(data)}/lti/link`);
}
