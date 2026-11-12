'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  accountStatusAction,
  blockDomainAction,
  unblockDomainAction,
  type PersonRow,
  type ProtectionState,
} from '../app/_lib/protection-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: ProtectionState = {};

/** Suspends or reinstates one account; the button follows the account's current state. */
export function AccountStatusForm(props: {
  readonly locale: Locale;
  readonly person: PersonRow;
  readonly suspended: boolean;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(accountStatusAction, initial);
  const suspended = state.suspended ?? props.suspended;
  return (
    <form
      action={action}
      className="button-row"
      aria-label={t('superAdmin.accountActions', { name: props.person.name })}
    >
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="schoolId" value={props.person.schoolId} />
      <input type="hidden" name="userId" value={props.person.id} />
      <input type="hidden" name="intent" value={suspended ? 'reinstate' : 'suspend'} />
      {suspended ? <span className="chip">{t('superAdmin.suspendedBadge')}</span> : null}
      <Submit label={suspended ? t('superAdmin.reinstate') : t('superAdmin.suspend')} />
      <FormAlert message={state.errors?.form} />
      {state.person === undefined ? null : (
        <p role="status" className="notice">
          {state.suspended === true
            ? t('superAdmin.userSuspended', { email: state.person.email })
            : t('superAdmin.userReinstated', { email: state.person.email })}
        </p>
      )}
    </form>
  );
}

/** Blocks a domain and lists who it suspended, each with a Reinstate button. */
export function BlockDomainForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(blockDomainAction, initial);
  return (
    <div className="stack">
      <form
        key={state.version ?? 0}
        action={action}
        className="stack"
        noValidate
        aria-label={t('superAdmin.blockDomain')}
      >
        <input type="hidden" name="locale" value={locale} />
        <FormAlert message={state.errors?.form} />
        <Field label={t('superAdmin.domain')} name="domain" error={state.errors?.domain} required />
        <Submit label={t('superAdmin.blockDomain')} />
      </form>
      {state.blocked === undefined ? null : (
        <section className="stack" aria-label={t('superAdmin.suspendedAccounts')}>
          <p role="status" className="notice">
            {t('superAdmin.domainBlocked', {
              domain: state.blocked.domain,
              count: state.blocked.suspended.length,
            })}
          </p>
          <ul className="list">
            {state.blocked.suspended.map((person) => (
              <li key={person.id}>
                {person.name} <span className="hint">{person.email}</span>
                <AccountStatusForm locale={locale} person={person} suspended />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function UnblockDomainForm(props: { readonly locale: Locale; readonly domain: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(unblockDomainAction, initial);
  return (
    <form
      action={action}
      className="button-row"
      aria-label={`${t('superAdmin.unblock')} ${props.domain}`}
    >
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="domain" value={props.domain} />
      <Submit label={t('superAdmin.unblock')} />
      <FormAlert message={state.errors?.form} />
    </form>
  );
}
