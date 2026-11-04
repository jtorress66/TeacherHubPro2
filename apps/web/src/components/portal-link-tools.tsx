'use client';

import { useActionState } from 'react';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  emailPortalLinkAction,
  issuePortalLinkAction,
  type PortalFormState,
} from '../app/_lib/portal-actions.ts';
import { CopyLink } from './assignment-tools.tsx';
import { FormAlert } from './forms.tsx';
import { Hidden } from './form-fields.tsx';

const initial: PortalFormState = {};

const firstError = (state: PortalFormState): string | undefined =>
  state.errors === undefined ? undefined : Object.values(state.errors)[0];

interface StudentProps {
  readonly locale: Locale;
  readonly classId: string;
  readonly studentId: string;
  readonly name: string;
}

/** Emails a family their link, prefilled with the roster's parent email. */
export function EmailPortalLinkForm(props: StudentProps & { readonly parentEmail: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(emailPortalLinkAction, initial);
  const id = `portal-${props.studentId}`;
  return (
    <form action={action} className="stack" aria-label={`${t('portalLinks.email')}: ${props.name}`}>
      <Hidden
        values={{ locale: props.locale, classId: props.classId, studentId: props.studentId }}
      />
      <FormAlert message={firstError(state)} />
      {state.sentTo === undefined ? null : (
        <p role="status" className="notice">
          {t('portalLinks.sent', { email: state.sentTo })}
        </p>
      )}
      <div className="field-row align-end">
        <div className="field">
          <label htmlFor={`${id}-to`}>{t('portalLinks.emailTo')}</label>
          <input id={`${id}-to`} name="to" type="email" defaultValue={props.parentEmail} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-language`}>{t('portalLinks.emailLanguage')}</label>
          <select id={`${id}-language`} name="language" defaultValue={props.locale}>
            {locales.map((l) => (
              <option key={l} value={l}>
                {localeInfo[l].nativeName}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button">
          {t('portalLinks.send')}
        </button>
      </div>
    </form>
  );
}

/** Makes a new link to copy now; it is never shown again. */
export function NewPortalLinkForm(props: StudentProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(issuePortalLinkAction, initial);
  return (
    <div className="stack">
      <form action={action} aria-label={`${t('portalLinks.showLink')}: ${props.name}`}>
        <Hidden
          values={{
            locale: props.locale,
            classId: props.classId,
            studentId: props.studentId,
            language: props.locale,
          }}
        />
        <FormAlert message={firstError(state)} />
        <button type="submit" className="button secondary">
          {t('portalLinks.showLink')}
        </button>
      </form>
      {state.url === undefined ? null : (
        <section
          className="card stack"
          aria-label={t('portalLinks.newLinkTitle', { name: props.name })}
        >
          <p className="notice">{t('portalLinks.newLinkNote')}</p>
          <p>
            <a href={state.url} data-testid="portal-link">
              {state.url}
            </a>{' '}
            <CopyLink locale={props.locale} url={state.url} />
          </p>
        </section>
      )}
    </div>
  );
}
