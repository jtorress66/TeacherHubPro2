'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { openInCanvaAction, type CanvaFormState } from '../app/_lib/canva-actions.ts';
import { Hidden } from './form-fields.tsx';

const initial: CanvaFormState = {};

/** "Open in Canva": imports a presentation or AI-written material, then links to the design. */
export function OpenInCanvaForm(props: {
  readonly locale: Locale;
  readonly kind: 'presentation' | 'generation';
  readonly id: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action, pending] = useActionState(openInCanvaAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('canva.open')}>
      <Hidden values={{ locale: props.locale, kind: props.kind, id: props.id }} />
      <p>
        <button type="submit" className="button secondary" disabled={pending}>
          {pending ? t('canva.sending') : t('canva.open')}
        </button>
      </p>
      {state.editUrl === undefined ? null : (
        <p role="status" className="notice">
          {t('canva.ready')}{' '}
          <a href={state.editUrl} target="_blank" rel="noopener noreferrer">
            {t('canva.openDesign')}
          </a>
        </p>
      )}
      {state.error === undefined ? null : (
        <p role="alert" className="alert">
          {state.connect === true ? t('canva.connectFirst') : state.error}{' '}
          {state.connect === true ? (
            <a href={`/${props.locale}/app/settings`}>{t('canva.settingsLink')}</a>
          ) : null}
        </p>
      )}
      <p className="muted">{t('canva.note')}</p>
    </form>
  );
}
