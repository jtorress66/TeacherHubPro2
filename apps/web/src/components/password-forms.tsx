'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  requestPasswordResetAction,
  setPasswordAction,
  setUpSuperAdminAction,
  type PasswordFormState,
} from '../app/_lib/password-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: PasswordFormState = {};

export function ForgotPasswordForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(requestPasswordResetAction, initial);
  if (state.done === true) {
    return (
      <p role="status" className="notice">
        {t('passwords.resetSent')}
      </p>
    );
  }
  return (
    <form action={action} className="stack" noValidate aria-label={t('passwords.forgotTitle')}>
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
      <Submit label={t('passwords.sendReset')} />
    </form>
  );
}

/**
 * Chooses a password from an emailed link. The link's secret is in its #hash, which the browser
 * never sends to the server; the page posts it with the form.
 */
export function SetPasswordForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(setPasswordAction, initial);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/u, ''));
  }, []);

  if (state.done === true) {
    return (
      <div className="stack">
        <p role="status" className="notice">
          {t('passwords.saved')}
        </p>
        <p>
          <Link className="button" href={`/${locale}/login`}>
            {t('auth.logIn')}
          </Link>
        </p>
      </div>
    );
  }
  if (token === '') {
    return (
      <p role="alert" className="alert">
        {t('passwords.noLink')}
      </p>
    );
  }
  const linkError = state.errors?.form;
  return (
    <form action={action} className="stack" noValidate aria-label={t('passwords.setTitle')}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token ?? ''} />
      <FormAlert message={linkError} />
      {linkError === undefined ? null : (
        <p>
          <Link href={`/${locale}/forgot-password`}>{t('passwords.forgot')}</Link>
        </p>
      )}
      <Field
        label={t('passwords.newPassword')}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t('passwords.setIntro')}
        error={state.errors?.password}
        required
      />
      <Submit label={t('passwords.save')} />
    </form>
  );
}

export function SetUpSuperAdminForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(setUpSuperAdminAction, initial);
  if (state.done === true) {
    return (
      <div className="stack">
        <p role="status" className="notice">
          {t('passwords.setupDone', { email: state.email ?? '' })}
        </p>
        <p>
          <Link className="button" href={`/${locale}/login`}>
            {t('auth.logIn')}
          </Link>
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="stack" noValidate aria-label={t('passwords.setupTitle')}>
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
        label={t('passwords.setupKey')}
        name="key"
        type="password"
        autoComplete="off"
        required
      />
      <Submit label={t('passwords.setupButton')} />
    </form>
  );
}
