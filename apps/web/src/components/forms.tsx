'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  logInAction,
  signUpAction,
  updateProfileAction,
  updateSchoolAction,
  upgradeAction,
  type FormState,
} from '../app/_lib/actions.ts';

interface FieldProps {
  readonly label: string;
  readonly name: string;
  /** Defaults to the name; needed when one page has the same field twice. */
  readonly id?: string;
  readonly error?: string | undefined;
  readonly type?: string;
  readonly defaultValue?: string | number | null | undefined;
  readonly hint?: string;
  readonly autoComplete?: string;
  readonly min?: number;
  readonly required?: boolean;
}

function Field(props: FieldProps) {
  const {
    label,
    name,
    error,
    type = 'text',
    defaultValue,
    hint,
    autoComplete,
    min,
    required,
  } = props;
  const id = props.id ?? name;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        autoComplete={autoComplete}
        min={min}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Submit({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending}>
      {label}
    </button>
  );
}

function FormAlert({ message }: { readonly message?: string | undefined }) {
  return message ? (
    <p role="alert" className="alert">
      {message}
    </p>
  ) : null;
}

const initial: FormState = {};

export function SignUpForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(signUpAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('auth.name')}
        name="name"
        autoComplete="name"
        error={state.errors?.name}
        required
      />
      <Field
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        error={state.errors?.email}
        required
      />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={state.errors?.password}
        required
      />
      <Submit label={t('auth.createAccount')} />
    </form>
  );
}

export function LogInForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(logInAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('auth.email')}
        name="email"
        type="email"
        autoComplete="email"
        error={state.errors?.email}
        required
      />
      <Field
        label={t('auth.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        error={state.errors?.password}
        required
      />
      <Submit label={t('auth.logIn')} />
    </form>
  );
}

function Saved({ state, label }: { readonly state: FormState; readonly label: string }) {
  return state.saved ? (
    <p role="status" className="notice">
      {label}
    </p>
  ) : null;
}

export function ProfileForm(props: {
  readonly locale: Locale;
  readonly name: string;
  readonly language: Locale;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(updateProfileAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={props.locale} />
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('settings.name')}
        name="name"
        id="profile-name"
        defaultValue={props.name}
        error={state.errors?.name}
        required
      />
      <div className="field">
        <label htmlFor="language">{t('settings.language')}</label>
        <select id="language" name="language" defaultValue={props.language}>
          {locales.map((code) => (
            <option key={code} value={code}>
              {localeInfo[code].nativeName}
            </option>
          ))}
        </select>
      </div>
      <Saved state={state} label={t('settings.saved')} />
      <Submit label={t('settings.save')} />
    </form>
  );
}

export interface SchoolFields {
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export function SchoolForm({
  locale,
  school,
}: {
  readonly locale: Locale;
  readonly school: SchoolFields;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(updateSchoolAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('settings.schoolName')}
        name="name"
        id="school-name"
        defaultValue={school.name}
        error={state.errors?.name}
        required
      />
      <Field
        label={t('settings.address')}
        name="address"
        id="school-address"
        defaultValue={school.address}
        error={state.errors?.address}
      />
      <Field
        label={t('settings.phone')}
        name="phone"
        id="school-phone"
        type="tel"
        defaultValue={school.phone}
        error={state.errors?.phone}
      />
      <Field
        label={t('settings.schoolEmail')}
        name="email"
        id="school-email"
        type="email"
        defaultValue={school.email}
        error={state.errors?.email}
      />
      <Saved state={state} label={t('settings.saved')} />
      <Submit label={t('settings.save')} />
    </form>
  );
}

export function UpgradeForm(props: {
  readonly locale: Locale;
  readonly planId: string;
  readonly planName: string;
  /** For School and District plans: the fewest teachers that can be bought. */
  readonly minimumSeats: number | null;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(upgradeAction, initial);
  return (
    <form action={action} className="stack" noValidate aria-label={props.planName}>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="plan" value={props.planId} />
      <FormAlert message={state.errors?.form} />
      {props.minimumSeats === null ? null : (
        <Field
          label={t('billing.teachers')}
          name="quantity"
          id={`quantity-${props.planId}`}
          type="number"
          min={props.minimumSeats}
          defaultValue={props.minimumSeats}
          error={state.errors?.quantity}
        />
      )}
      <Submit label={t('billing.choose', { plan: props.planName })} />
    </form>
  );
}
