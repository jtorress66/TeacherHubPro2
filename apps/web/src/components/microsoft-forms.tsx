'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { saveToOneDriveAction, type OneDriveFormState } from '../app/_lib/microsoft-actions.ts';
import { Hidden } from './form-fields.tsx';

const initial: OneDriveFormState = {};

/** "Save to OneDrive": saves a presentation or AI-written material, then links to the file. */
export function SaveToOneDriveForm(props: {
  readonly locale: Locale;
  readonly kind: 'presentation' | 'generation';
  readonly id: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action, pending] = useActionState(saveToOneDriveAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('microsoft.save')}>
      <Hidden values={{ locale: props.locale, kind: props.kind, id: props.id }} />
      <p>
        <button type="submit" className="button secondary" disabled={pending}>
          {pending ? t('microsoft.saving') : t('microsoft.save')}
        </button>
      </p>
      {state.webUrl === undefined ? null : (
        <p role="status" className="notice">
          {t('microsoft.saved')}{' '}
          <a href={state.webUrl} target="_blank" rel="noopener noreferrer">
            {t('microsoft.openFile')}
          </a>
        </p>
      )}
      {state.error === undefined ? null : (
        <p role="alert" className="alert">
          {state.connect === true ? t('microsoft.connectFirst') : state.error}{' '}
          {state.connect === true ? (
            <a href={`/${props.locale}/app/settings`}>{t('microsoft.settingsLink')}</a>
          ) : null}
        </p>
      )}
      <p className="muted">{t('microsoft.note')}</p>
    </form>
  );
}
