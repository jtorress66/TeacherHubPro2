'use client';

import { useActionState } from 'react';
import { planFormats, type Role } from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  changeUserRoleAction,
  createSchoolAction,
  createUserAction,
  deleteSchoolAction,
  deleteUserAction,
  importSchoolStudentsAction,
  importTeachersAction,
  sendPasswordLinkAction,
  transferClassesAction,
  updateSchoolAction,
  updateUserAction,
  type AdminFormState,
} from '../app/_lib/admin-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, type Option } from './form-fields.tsx';

const initial: AdminFormState = {};

const roleOptions = (locale: Locale, roles: readonly Role[]): Option[] => {
  const t = createTranslator(locale);
  return roles.map((role) => ({ id: role, name: t(`admin.role_${role}`) }));
};

/** The first error of a form that has no field to show it under. */
const alertOf = (state: AdminFormState, fields: readonly string[] = []) =>
  Object.entries(state.errors ?? {}).find(([field]) => !fields.includes(field))?.[1];

function Notice({ message }: { readonly message: string | undefined }) {
  return message === undefined ? null : (
    <p role="status" className="notice">
      {message}
    </p>
  );
}

export function RoleForm(props: {
  readonly locale: Locale;
  readonly userId: string;
  readonly name: string;
  readonly role: Role;
  readonly roles: readonly Role[];
  readonly schoolId?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(changeUserRoleAction, initial);
  return (
    <form
      action={action}
      className="inline-form"
      aria-label={t('admin.roleFor', { name: props.name })}
    >
      <Hidden
        values={{
          locale: props.locale,
          userId: props.userId,
          ...(props.schoolId === undefined ? {} : { schoolId: props.schoolId }),
        }}
      />
      <label className="visually-hidden" htmlFor={`role-${props.userId}`}>
        {t('admin.roleFor', { name: props.name })}
      </label>
      <select id={`role-${props.userId}`} name="role" defaultValue={props.role}>
        {roleOptions(props.locale, props.roles).map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>{' '}
      <Submit label={t('admin.saveRole')} />
      <FormAlert message={alertOf(state)} />
      <Notice message={state.notice === 'saved' ? t('admin.roleSaved') : undefined} />
    </form>
  );
}

export function SendLinkForm(props: {
  readonly locale: Locale;
  readonly userId: string;
  readonly email: string;
  readonly schoolId?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(sendPasswordLinkAction, initial);
  return (
    <form
      action={action}
      className="inline-form"
      aria-label={`${t('admin.sendLink')}: ${props.email}`}
    >
      <Hidden
        values={{
          locale: props.locale,
          userId: props.userId,
          ...(props.schoolId === undefined ? {} : { schoolId: props.schoolId }),
        }}
      />
      <button type="submit" className="button secondary">
        {t('admin.sendLink')}
      </button>
      <FormAlert message={alertOf(state)} />
      <Notice
        message={state.notice === 'sent' ? t('admin.linkSent', { email: props.email }) : undefined}
      />
    </form>
  );
}

export function TransferForm(props: {
  readonly locale: Locale;
  readonly teachers: readonly Option[];
  readonly schoolId?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(transferClassesAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('admin.transfer')} key={state.version}>
      <Hidden
        values={{
          locale: props.locale,
          ...(props.schoolId === undefined ? {} : { schoolId: props.schoolId }),
        }}
      />
      <FormAlert message={alertOf(state)} />
      <Notice
        message={
          state.count === undefined ? undefined : t('admin.transferDone', { count: state.count })
        }
      />
      <div className="field-row">
        <Select
          id="transfer-from"
          name="fromUserId"
          label={t('admin.transferFrom')}
          options={props.teachers}
        />
        <Select
          id="transfer-to"
          name="toUserId"
          label={t('admin.transferTo')}
          options={props.teachers}
        />
      </div>
      <Submit label={t('admin.transfer')} />
    </form>
  );
}

interface SchoolValues {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly planFormat: string;
}

/** A new school, or a school's details. */
export function SchoolDetailsForm(props: {
  readonly locale: Locale;
  readonly school?: SchoolValues;
}) {
  const t = createTranslator(props.locale);
  const editing = props.school !== undefined;
  const [state, action] = useActionState(
    editing ? updateSchoolAction : createSchoolAction,
    initial,
  );
  const errors = state.errors ?? {};
  const label = editing ? t('superAdmin.saveSchool') : t('superAdmin.createSchool');
  return (
    <form action={action} className="stack" noValidate aria-label={label}>
      <Hidden
        values={{
          locale: props.locale,
          ...(props.school === undefined ? {} : { schoolId: props.school.id }),
        }}
      />
      <FormAlert message={alertOf(state, ['name', 'address', 'phone', 'email', 'planFormat'])} />
      <Notice message={state.notice === 'saved' ? t('superAdmin.schoolSaved') : undefined} />
      <Field
        id={editing ? 'school-name' : 'new-school-name'}
        name="name"
        label={t('superAdmin.schoolName')}
        defaultValue={props.school?.name}
        error={errors.name}
        required
      />
      <div className="field-row">
        <Field
          id={editing ? 'school-address' : 'new-school-address'}
          name="address"
          label={t('superAdmin.address')}
          defaultValue={props.school?.address}
          error={errors.address}
        />
        <Field
          id={editing ? 'school-phone' : 'new-school-phone'}
          name="phone"
          label={t('superAdmin.phone')}
          defaultValue={props.school?.phone}
          error={errors.phone}
        />
        <Field
          id={editing ? 'school-email' : 'new-school-email'}
          name="email"
          type="email"
          label={t('superAdmin.schoolEmail')}
          defaultValue={props.school?.email}
          error={errors.email}
        />
      </div>
      <Select
        id={editing ? 'school-plan-format' : 'new-school-plan-format'}
        name="planFormat"
        label={t('settings.planFormat')}
        options={planFormats.map((format) => ({
          id: format,
          name: t(`settings.planFormat_${format}`),
        }))}
        defaultValue={props.school?.planFormat}
        error={errors.planFormat}
      />
      <Submit label={label} />
    </form>
  );
}

/** Deletes a school or a user; the action names what is refused, such as people still in it. */
export function DeleteForm(props: {
  readonly locale: Locale;
  readonly kind: 'school' | 'user';
  readonly schoolId: string;
  readonly userId?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(
    props.kind === 'school' ? deleteSchoolAction : deleteUserAction,
    initial,
  );
  const label = props.kind === 'school' ? t('superAdmin.deleteSchool') : t('superAdmin.deleteUser');
  return (
    <form action={action} className="stack" aria-label={label}>
      <Hidden
        values={{
          locale: props.locale,
          schoolId: props.schoolId,
          ...(props.userId === undefined ? {} : { userId: props.userId }),
        }}
      />
      <p className="hint">
        {props.kind === 'school'
          ? t('superAdmin.deleteSchoolHint')
          : t('superAdmin.deleteUserHint')}
      </p>
      <FormAlert message={alertOf(state)} />
      <p>
        <button type="submit" className="button secondary">
          {label}
        </button>
      </p>
    </form>
  );
}

export function NewUserForm(props: { readonly locale: Locale; readonly schoolId: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(createUserAction, initial);
  const errors = state.errors ?? {};
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('superAdmin.newUser')}
      key={state.version}
    >
      <Hidden values={{ locale: props.locale, schoolId: props.schoolId }} />
      <FormAlert message={alertOf(state, ['name', 'email'])} />
      <Notice
        message={
          state.notice === undefined
            ? undefined
            : t('superAdmin.userCreated', { email: state.notice })
        }
      />
      <div className="field-row">
        <Field
          id="new-user-name"
          name="name"
          label={t('admin.name')}
          error={errors.name}
          required
        />
        <Field
          id="new-user-email"
          name="email"
          type="email"
          label={t('admin.email')}
          error={errors.email}
          required
        />
        <Select
          id="new-user-role"
          name="role"
          label={t('admin.role')}
          options={roleOptions(props.locale, ['teacher', 'school_admin', 'super_admin'])}
          defaultValue="teacher"
        />
        <Select
          id="new-user-language"
          name="language"
          label={t('superAdmin.language')}
          options={locales.map((l) => ({ id: l, name: localeInfo[l].nativeName }))}
          defaultValue={props.locale}
        />
      </div>
      <Submit label={t('superAdmin.createUser')} />
    </form>
  );
}

export function EditUserForm(props: {
  readonly locale: Locale;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly role: Role;
    readonly schoolId: string;
  };
  readonly schools: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(updateUserAction, initial);
  const errors = state.errors ?? {};
  const { user } = props;
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('superAdmin.editUser', { name: user.name })}
    >
      <Hidden values={{ locale: props.locale, userId: user.id, currentSchoolId: user.schoolId }} />
      <FormAlert message={alertOf(state, ['name', 'email'])} />
      <div className="field-row">
        <Field
          id="edit-user-name"
          name="name"
          label={t('admin.name')}
          defaultValue={user.name}
          error={errors.name}
          required
        />
        <Field
          id="edit-user-email"
          name="email"
          type="email"
          label={t('admin.email')}
          defaultValue={user.email}
          error={errors.email}
          required
        />
        <Select
          id="edit-user-role"
          name="role"
          label={t('admin.role')}
          options={roleOptions(props.locale, ['teacher', 'school_admin', 'super_admin'])}
          defaultValue={user.role}
        />
        <Select
          id="edit-user-school"
          name="schoolId"
          label={t('superAdmin.school')}
          options={props.schools}
          defaultValue={user.schoolId}
        />
      </div>
      <Submit label={t('superAdmin.saveUser')} />
    </form>
  );
}

function ImportForm(props: {
  readonly locale: Locale;
  readonly kind: 'teachers' | 'students';
  readonly targets: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const teachers = props.kind === 'teachers';
  const [state, action] = useActionState(
    teachers ? importTeachersAction : importSchoolStudentsAction,
    initial,
  );
  const label = teachers ? t('superAdmin.importTeachers') : t('superAdmin.importStudents');
  const id = teachers ? 'import-teachers' : 'import-students';
  return (
    <form action={action} className="stack" aria-label={label} key={state.version}>
      <Hidden values={{ locale: props.locale }} />
      {state.rowErrors === undefined ? null : (
        <ul role="alert" className="alert">
          {state.rowErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <Notice
        message={
          state.count === undefined ? undefined : t('superAdmin.imported', { count: state.count })
        }
      />
      <Select
        id={`${id}-target`}
        name={teachers ? 'schoolId' : 'classRef'}
        label={teachers ? t('superAdmin.school') : t('superAdmin.class')}
        options={props.targets}
      />
      <div className="field">
        <label htmlFor={`${id}-file`}>{t('superAdmin.file')}</label>
        <input id={`${id}-file`} name="file" type="file" accept=".csv,text/csv" />
      </div>
      <Submit label={t('superAdmin.importButton')} />
    </form>
  );
}

export function ImportTeachersForm(props: {
  readonly locale: Locale;
  readonly schools: readonly Option[];
}) {
  return <ImportForm locale={props.locale} kind="teachers" targets={props.schools} />;
}

/** Classes are named "School · Class", with `schoolId/classId` as the value. */
export function ImportStudentsForm(props: {
  readonly locale: Locale;
  readonly classes: readonly Option[];
}) {
  return <ImportForm locale={props.locale} kind="students" targets={props.classes} />;
}
