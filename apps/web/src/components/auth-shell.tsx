import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';

/** The frame around sign-up and login: the brand, a card, and the Google option. */
export function AuthShell(props: {
  readonly locale: Locale;
  readonly title: string;
  readonly subtitle?: string;
  readonly notice?: string | undefined;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) {
  const t = createTranslator(props.locale);
  return (
    <main className="auth">
      <Link href={`/${props.locale}`} className="brand">
        {t('app.name')}
      </Link>
      <section className="card stack">
        <h1>{props.title}</h1>
        {props.subtitle ? <p className="muted">{props.subtitle}</p> : null}
        {props.notice ? (
          <p role="alert" className="alert">
            {props.notice}
          </p>
        ) : null}
        <a className="button secondary" href={`/api/auth/google/start?locale=${props.locale}`}>
          {t('auth.continueWithGoogle')}
        </a>
        <p className="divider">{t('auth.or')}</p>
        {props.children}
      </section>
      <p className="muted">{props.footer}</p>
    </main>
  );
}
