'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  confirmEmailAction,
  resendConfirmationAction,
  type ConfirmEmailState,
} from '../app/_lib/confirm-email-actions.ts';
import { FormAlert, Submit } from './forms.tsx';

const initial: ConfirmEmailState = {};

/**
 * Confirms the email from an emailed link. The link's secret is in its #hash, which the browser
 * never sends to the server; the page posts it when the person presses the button.
 */
export function ConfirmEmailForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(confirmEmailAction, initial);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/u, ''));
  }, []);

  if (state.done === true) {
    return (
      <div className="stack">
        <p role="status" className="notice">
          {t('confirmEmail.confirmed')}
        </p>
        <p>
          <Link className="button" href={`/${locale}/app`}>
            {t('confirmEmail.openApp')}
          </Link>
        </p>
      </div>
    );
  }
  if (token === '') {
    return (
      <p role="alert" className="alert">
        {t('confirmEmail.noLink')}
      </p>
    );
  }
  return (
    <form action={action} className="stack" noValidate aria-label={t('confirmEmail.title')}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token ?? ''} />
      <FormAlert message={state.errors?.form} />
      <Submit label={t('emails.confirmButton')} />
    </form>
  );
}

/** The app's banner until the email is confirmed, with a Resend button. */
export function ConfirmEmailBanner(props: { readonly locale: Locale; readonly email: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(resendConfirmationAction, initial);
  return (
    <section className="notice confirm-banner no-print" aria-labelledby="confirm-banner-title">
      <h2 id="confirm-banner-title">{t('confirmEmail.bannerTitle')}</h2>
      <p>{t('confirmEmail.bannerText', { email: props.email })}</p>
      <form action={action} className="button-row">
        <input type="hidden" name="locale" value={props.locale} />
        <Submit label={t('confirmEmail.resend')} />
      </form>
      {state.done === true ? (
        <p role="status">{t('confirmEmail.resent', { email: props.email })}</p>
      ) : (
        <FormAlert message={state.errors?.form} />
      )}
    </section>
  );
}
