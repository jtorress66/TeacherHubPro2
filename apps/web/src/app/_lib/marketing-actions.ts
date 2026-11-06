'use server';

import { revalidatePath } from 'next/cache';
import { leadStatuses, type LeadId, type LeadStatus } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { requireUser } from './auth.ts';

export interface LeadFormState {
  readonly errors?: Readonly<Record<string, string>>;
  readonly sent?: boolean;
}

const localeOf = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : 'en';
};

const text = (data: FormData, key: string): string => {
  const value = data.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const optional = (data: FormData, key: string): string | null => {
  const value = text(data, key);
  return value === '' ? null : value;
};

/** The contact form and the chat's "leave my details" form: a lead for the team. */
export async function captureLeadAction(
  _state: LeadFormState,
  data: FormData,
): Promise<LeadFormState> {
  const locale = localeOf(data);
  const captured = await getAppContainer().captureLead.execute({
    name: text(data, 'name'),
    email: text(data, 'email'),
    organization: optional(data, 'organization'),
    role: text(data, 'role') || 'other',
    phone: optional(data, 'phone'),
    interest: text(data, 'interest') || 'other',
    source: text(data, 'source') === 'chat' ? 'chat' : 'contact',
    message: optional(data, 'message'),
    locale,
    page: optional(data, 'page'),
  });
  if (!captured.ok) return { errors: formErrors(captured.error, locale) };
  return { sent: true };
}

/** A super admin marks a lead as contacted or closed. */
export async function updateLeadStatusAction(data: FormData): Promise<void> {
  const locale = localeOf(data);
  const { user } = await requireUser(locale, { needsAccess: false });
  const status = text(data, 'status');
  if (!(leadStatuses as readonly string[]).includes(status)) return;
  await getAppContainer().updateLeadStatus.execute({
    actor: user,
    leadId: text(data, 'leadId') as LeadId,
    status: status as LeadStatus,
  });
  revalidatePath(`/${locale}/app/super-admin/leads`);
}
