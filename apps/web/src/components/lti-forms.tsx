'use client';

import { useActionState, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  linkLtiAccountAction,
  registerLtiPlatformAction,
  type LtiFormState,
} from '../app/_lib/lti-actions.ts';
import { Hidden } from './form-fields.tsx';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: LtiFormState = {};

/** One value IT pastes into the course system: shown read-only, with its own copy button. */
export function CopyValue(props: {
  readonly locale: Locale;
  readonly id: string;
  readonly label: string;
  readonly value: string;
}) {
  const t = createTranslator(props.locale);
  const [copied, setCopied] = useState(false);
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <div className="inline-form">
        <input
          id={props.id}
          type="text"
          readOnly
          value={props.value}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
        />
        <button
          type="button"
          className="button secondary"
          aria-label={t('lti.copy', { label: props.label })}
          onClick={() => {
            void navigator.clipboard.writeText(props.value).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? t('lti.copied') : t('lti.copyButton')}
        </button>
      </div>
    </div>
  );
}

const platformFields = [
  'issuer',
  'clientId',
  'deploymentIds',
  'authLoginUrl',
  'authTokenUrl',
  'jwksUrl',
] as const;

const labelKey = {
  issuer: 'lti.issuer',
  clientId: 'lti.clientId',
  deploymentIds: 'lti.deploymentIds',
  authLoginUrl: 'lti.authLoginUrl',
  authTokenUrl: 'lti.authTokenUrl',
  jwksUrl: 'lti.platformJwksUrl',
} as const;

/** The details a course system shows when TeacherHubPro is added to it. */
export function LtiPlatformForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(registerLtiPlatformAction, initial);
  const errors = state.errors ?? {};
  const known = ['name', ...platformFields];
  const formError = Object.entries(errors).find(([name]) => !known.includes(name))?.[1];
  return (
    <form action={action} className="stack" aria-label={t('lti.addTitle')} key={state.version}>
      <Hidden values={{ locale }} />
      <FormAlert message={formError} />
      {state.notice === undefined ? null : (
        <p role="status" className="notice">
          {state.notice}
        </p>
      )}
      <Field
        label={t('lti.name')}
        name="name"
        id="lti-name"
        hint={t('lti.nameHint')}
        error={errors.name}
      />
      {platformFields.map((name) => (
        <Field
          key={name}
          label={t(labelKey[name])}
          name={name}
          id={`lti-${name}`}
          type={name.endsWith('Url') ? 'url' : 'text'}
          {...(name === 'deploymentIds' ? { hint: t('lti.deploymentIdsHint') } : {})}
          error={errors[name]}
        />
      ))}
      <Submit label={t('lti.add')} />
    </form>
  );
}

/** The signed-in teacher confirms linking the course system user waiting to be linked. */
export function LinkLtiAccountForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(linkLtiAccountAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('lti.linkTitle')}>
      <Hidden values={{ locale }} />
      <FormAlert message={state.errors?.form} />
      <Submit label={t('lti.linkConfirm')} />
    </form>
  );
}
