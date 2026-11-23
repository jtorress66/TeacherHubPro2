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
  extendTrialAction,
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
import { prefill } from '../server/form-values.ts';

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
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="inline-form"
      aria-label={t('admin.roleFor', { name: props.name })}
      key={sent.key}
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
      <select id={`role-${props.userId}`} name="role" defaultValue={sent.text('role', props.role)}>
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
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      aria-label={t('admin.transfer')}
      key={`${String(state.version ?? 0)}-${sent.key}`}
    >
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
          defaultValue={sent.text('fromUserId')}
        />
        <Select
          id="transfer-to"
          name="toUserId"
          label={t('admin.transferTo')}
          options={props.teachers}
          defaultValue={sent.text('toUserId')}
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
  const sent = prefill(state.values);
  return (
    <form action={action} className="stack" noValidate aria-label={label} key={sent.key}>
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
        defaultValue={sent.text('name', props.school?.name)}
        error={errors.name}
        required
      />
      <div className="field-row">
        <Field
          id={editing ? 'school-address' : 'new-school-address'}
          name="address"
          label={t('superAdmin.address')}
          defaultValue={sent.text('address', props.school?.address)}
          error={errors.address}
        />
        <Field
          id={editing ? 'school-phone' : 'new-school-phone'}
          name="phone"
          label={t('superAdmin.phone')}
          defaultValue={sent.text('phone', props.school?.phone)}
          error={errors.phone}
        />
        <Field
          id={editing ? 'school-email' : 'new-school-email'}
          name="email"
          type="email"
          label={t('superAdmin.schoolEmail')}
          defaultValue={sent.text('email', props.school?.email)}
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
        defaultValue={sent.text('planFormat', props.school?.planFormat)}
        error={errors.planFormat}
      />
      <Submit label={label} />
    </form>
  );
}

/** A super admin gives a school more free trial days, for example an app reviewer. */
export function TrialForm(props: { readonly locale: Locale; readonly schoolId: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(extendTrialAction, initial);
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="inline-form"
      noValidate
      aria-label={t('superAdmin.extendTrial')}
      key={sent.key}
    >
      <Hidden values={{ locale: props.locale, schoolId: props.schoolId }} />
      <FormAlert message={alertOf(state, ['days'])} />
      <Notice
        message={state.notice === 'trialExtended' ? t('superAdmin.trialExtended') : undefined}
      />
      <Field
        id="trial-days"
        name="days"
        type="number"
        label={t('superAdmin.trialDays')}
        defaultValue={sent.text('days', '30')}
        error={state.errors?.days}
        min={1}
        max={90}
        required
      />
      <Submit label={t('superAdmin.extendTrial')} />
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
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('superAdmin.newUser')}
      key={`${String(state.version ?? 0)}-${sent.key}`}
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
          defaultValue={sent.text('name')}
          error={errors.name}
          required
        />
        <Field
          id="new-user-email"
          name="email"
          type="email"
          label={t('admin.email')}
          defaultValue={sent.text('email')}
          error={errors.email}
          required
        />
        <Select
          id="new-user-role"
          name="role"
          label={t('admin.role')}
          options={roleOptions(props.locale, ['teacher', 'school_admin', 'super_admin'])}
          defaultValue={sent.text('role', 'teacher')}
        />
        <Select
          id="new-user-language"
          name="language"
          label={t('superAdmin.language')}
          options={locales.map((l) => ({ id: l, name: localeInfo[l].nativeName }))}
          defaultValue={sent.text('language', props.locale)}
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
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('superAdmin.editUser', { name: user.name })}
      key={sent.key}
    >
      <Hidden values={{ locale: props.locale, userId: user.id, currentSchoolId: user.schoolId }} />
      <FormAlert message={alertOf(state, ['name', 'email'])} />
      <div className="field-row">
        <Field
          id="edit-user-name"
          name="name"
          label={t('admin.name')}
          defaultValue={sent.text('name', user.name)}
          error={errors.name}
          required
        />
        <Field
          id="edit-user-email"
          name="email"
          type="email"
          label={t('admin.email')}
          defaultValue={sent.text('email', user.email)}
          error={errors.email}
          required
        />
        <Select
          id="edit-user-role"
          name="role"
          label={t('admin.role')}
          options={roleOptions(props.locale, ['teacher', 'school_admin', 'super_admin'])}
          defaultValue={sent.text('role', user.role)}
        />
        <Select
          id="edit-user-school"
          name="schoolId"
          label={t('superAdmin.school')}
          options={props.schools}
          defaultValue={sent.text('schoolId', user.schoolId)}
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
  const sent = prefill(state.values);
  const target = teachers ? 'schoolId' : 'classRef';
  return (
    <form
      action={action}
      className="stack"
      aria-label={label}
      key={`${String(state.version ?? 0)}-${sent.key}`}
    >
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
        name={target}
        label={teachers ? t('superAdmin.school') : t('superAdmin.class')}
        options={props.targets}
        defaultValue={sent.text(target)}
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
