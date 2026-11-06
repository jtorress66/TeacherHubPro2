'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { roles, type ClassId, type Role, type SchoolId, type UserId } from '@thp/domain';
import { isLocale, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../container.ts';
import { formErrors } from '../../server/error-messages.ts';
import { importErrorMessages } from '../../server/import-messages.ts';
import { requireUser } from './auth.ts';

export interface AdminFormState {
  readonly errors?: Readonly<Record<string, string>>;
  /** Bulk imports: one message per bad row. */
  readonly rowErrors?: readonly string[];
  /** A short success message to show. */
  readonly notice?: string;
  readonly count?: number;
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

const optional = (data: FormData, key: string): string | null => {
  const value = text(data, key);
  return value === '' ? null : value;
};

const roleOf = (data: FormData): Role => {
  const value = text(data, 'role');
  return (roles as readonly string[]).includes(value) ? (value as Role) : 'teacher';
};

/** The school a form names, or none (the actor's own). */
const schoolOf = (data: FormData): { schoolId?: SchoolId } => {
  const value = text(data, 'schoolId');
  return value === '' ? {} : { schoolId: value as SchoolId };
};

const next = (state: AdminFormState, extra: Partial<AdminFormState> = {}): AdminFormState => ({
  ...extra,
  version: (state.version ?? 0) + 1,
});

async function actorOf(data: FormData) {
  const locale = localeOf(data);
  const { user } = await requireUser(locale);
  return { locale, actor: user };
}

const schoolDetails = (data: FormData) => ({
  name: text(data, 'name'),
  address: optional(data, 'address'),
  phone: optional(data, 'phone'),
  email: optional(data, 'email'),
});

export async function changeUserRoleAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const changed = await getAppContainer().changeUserRole.execute({
    actor,
    userId: text(data, 'userId') as UserId,
    role: roleOf(data),
    ...schoolOf(data),
  });
  if (!changed.ok) return { errors: formErrors(changed.error, locale) };
  revalidatePath(`/${locale}/app/admin`);
  return next(state, { notice: 'saved' });
}

export async function sendPasswordLinkAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const sent = await getAppContainer().sendPasswordLink.execute({
    actor,
    userId: text(data, 'userId') as UserId,
    ...schoolOf(data),
  });
  if (!sent.ok) return { errors: formErrors(sent.error, locale) };
  return next(state, { notice: 'sent' });
}

export async function transferClassesAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const moved = await getAppContainer().transferClasses.execute({
    actor,
    fromUserId: text(data, 'fromUserId') as UserId,
    toUserId: text(data, 'toUserId') as UserId,
    ...schoolOf(data),
  });
  if (!moved.ok) return { errors: formErrors(moved.error, locale) };
  revalidatePath(`/${locale}/app/admin`);
  return next(state, { count: moved.value });
}

export async function createSchoolAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const created = await getAppContainer().createSchool.execute({
    actor,
    details: schoolDetails(data),
  });
  if (!created.ok) return { errors: formErrors(created.error, locale) };
  redirect(`/${locale}/app/super-admin/schools/${created.value.id}`);
}

export async function updateSchoolAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const schoolId = text(data, 'schoolId') as SchoolId;
  const updated = await getAppContainer().updateSchool.execute({
    actor,
    schoolId,
    details: schoolDetails(data),
  });
  if (!updated.ok) return { errors: formErrors(updated.error, locale) };
  revalidatePath(`/${locale}/app/super-admin/schools/${schoolId}`);
  return next(state, { notice: 'saved' });
}

export async function deleteSchoolAction(
  _state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const deleted = await getAppContainer().deleteSchool.execute({
    actor,
    schoolId: text(data, 'schoolId') as SchoolId,
  });
  if (!deleted.ok) return { errors: formErrors(deleted.error, locale) };
  redirect(`/${locale}/app/super-admin/schools`);
}

export async function createUserAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const schoolId = text(data, 'schoolId') as SchoolId;
  const created = await getAppContainer().createUser.execute({
    actor,
    schoolId,
    details: {
      name: text(data, 'name'),
      email: text(data, 'email'),
      role: roleOf(data),
      language: text(data, 'language'),
    },
  });
  if (!created.ok) return { errors: formErrors(created.error, locale) };
  revalidatePath(`/${locale}/app/super-admin/schools/${schoolId}`);
  return next(state, { notice: created.value.email });
}

export async function updateUserAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const updated = await getAppContainer().updateUser.execute({
    actor,
    schoolId: text(data, 'currentSchoolId') as SchoolId,
    userId: text(data, 'userId') as UserId,
    details: {
      name: text(data, 'name'),
      email: text(data, 'email'),
      role: roleOf(data),
      schoolId: text(data, 'schoolId') as SchoolId,
    },
  });
  if (!updated.ok) return { errors: formErrors(updated.error, locale) };
  redirect(
    `/${locale}/app/super-admin/schools/${updated.value.schoolId}/users/${updated.value.id}?saved=1`,
  );
}

export async function deleteUserAction(
  _state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const schoolId = text(data, 'schoolId') as SchoolId;
  const deleted = await getAppContainer().deleteUser.execute({
    actor,
    schoolId,
    userId: text(data, 'userId') as UserId,
  });
  if (!deleted.ok) return { errors: formErrors(deleted.error, locale) };
  redirect(`/${locale}/app/super-admin/schools/${schoolId}`);
}

async function csvOf(data: FormData): Promise<string> {
  const file = data.get('file');
  return file instanceof File ? file.text() : '';
}

export async function importTeachersAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const imported = await getAppContainer().importTeachers.execute({
    actor,
    schoolId: text(data, 'schoolId') as SchoolId,
    csv: await csvOf(data),
  });
  if (!imported.ok) return { rowErrors: importErrorMessages(imported.error, locale) };
  return next(state, { count: imported.value.imported });
}

export async function importSchoolStudentsAction(
  state: AdminFormState,
  data: FormData,
): Promise<AdminFormState> {
  const { locale, actor } = await actorOf(data);
  const [schoolId, classId] = text(data, 'classRef').split('/');
  const imported = await getAppContainer().importSchoolStudents.execute({
    actor,
    schoolId: (schoolId ?? '') as SchoolId,
    classId: (classId ?? '') as ClassId,
    csv: await csvOf(data),
  });
  if (!imported.ok) return { rowErrors: importErrorMessages(imported.error, locale) };
  return next(state, { count: imported.value.imported });
}
