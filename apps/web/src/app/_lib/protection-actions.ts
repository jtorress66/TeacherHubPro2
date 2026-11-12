'use server';

import { revalidatePath } from 'next/cache';
import type { SchoolId, UserId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

/** A person a super admin acted on, as the forms show them. */
export interface PersonRow {
  readonly id: string;
  readonly schoolId: string;
  readonly name: string;
  readonly email: string;
}

export interface ProtectionState {
  readonly errors?: Readonly<Record<string, string>>;
  /** The account the last action changed. */
  readonly person?: PersonRow;
  readonly suspended?: boolean;
  /** The domain just blocked, with the accounts it suspended. */
  readonly blocked?: { readonly domain: string; readonly suspended: readonly PersonRow[] };
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

const rowOf = (user: PersonRow): PersonRow => ({
  id: user.id,
  schoolId: user.schoolId,
  name: user.name,
  email: user.email,
});

async function actorOf(data: FormData) {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const target = {
    schoolId: text(data, 'schoolId') as SchoolId,
    userId: text(data, 'userId') as UserId,
  };
  return { locale, actor: user, target };
}

/** Suspends or reinstates the account, as the form's button says. */
export async function accountStatusAction(
  state: ProtectionState,
  data: FormData,
): Promise<ProtectionState> {
  const { locale, actor, target } = await actorOf(data);
  const suspending = text(data, 'intent') === 'suspend';
  const app = getAppContainer();
  const done = suspending
    ? await app.suspendUser.execute({ actor, ...target })
    : await app.reinstateUser.execute({ actor, ...target });
  if (!done.ok) return { errors: formErrors(done.error, locale) };
  return { person: rowOf(done.value), suspended: suspending, version: (state.version ?? 0) + 1 };
}

export async function blockDomainAction(
  state: ProtectionState,
  data: FormData,
): Promise<ProtectionState> {
  const { locale, actor } = await actorOf(data);
  const done = await getAppContainer().blockDomain.execute({
    actor,
    domain: text(data, 'domain'),
  });
  if (!done.ok) return { errors: formErrors(done.error, locale) };
  revalidatePath(`/${locale}/app/super-admin/blocked-domains`);
  return {
    blocked: { domain: done.value.domain, suspended: done.value.suspended.map(rowOf) },
    version: (state.version ?? 0) + 1,
  };
}

export async function unblockDomainAction(
  state: ProtectionState,
  data: FormData,
): Promise<ProtectionState> {
  const { locale, actor } = await actorOf(data);
  const done = await getAppContainer().unblockDomain.execute({
    actor,
    domain: text(data, 'domain'),
  });
  if (!done.ok) return { errors: formErrors(done.error, locale) };
  revalidatePath(`/${locale}/app/super-admin/blocked-domains`);
  return { version: (state.version ?? 0) + 1 };
}
