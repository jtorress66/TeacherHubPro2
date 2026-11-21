'use client';

import type { ReactNode } from 'react';
import type { EmailTranslations, Language } from '@thp/domain';
import { createTranslator, localeInfo, type Locale } from '@thp/i18n';
import type { Prefill } from '../server/form-values.ts';
import { Field } from './forms.tsx';
import { TextArea } from './form-fields.tsx';

/**
 * The parent email in the families' other languages, inside the review form: which languages the
 * families read, the button that asks the AI for drafts, and each draft for the teacher to check.
 */
export function PrepTranslations(props: {
  readonly locale: Locale;
  readonly familyLanguages: readonly { readonly language: Language; readonly families: number }[];
  readonly translations: EmailTranslations | null;
  /** Saves the form's choices, then asks for the drafts. */
  readonly translateAction: (data: FormData) => void;
  readonly sent: Prefill;
  /** The refresher shown while the drafts are being made. */
  readonly refresher: ReactNode;
}) {
  const { locale, familyLanguages, translations, sent } = props;
  const t = createTranslator(locale);
  if (familyLanguages.length === 0) return null;
  const name = (language: Language) => localeInfo[language].nativeName;
  const list = familyLanguages
    .map(({ language, families }) => `${name(language)} (${String(families)})`)
    .join(', ');
  return (
    <div className="stack" data-testid="prep-translations">
      <p className="hint">{t('prep.familyLanguages', { languages: list })}</p>
      <p className="hint">{t('prep.translateHint')}</p>
      {translations?.status === 'running' ? (
        <>
          <p role="status">{t('prep.translating')}</p>
          {props.refresher}
        </>
      ) : (
        <p>
          <button type="submit" className="button secondary" formAction={props.translateAction}>
            {t('prep.translate')}
          </button>
        </p>
      )}
      {translations?.status === 'failed' ? (
        <p role="alert" className="alert">
          {t('prep.translationFailed')}
        </p>
      ) : null}
      {translations?.status === 'ready'
        ? translations.items.map((item) => {
            const field = `translation.${item.language}`;
            const id = `prep-translation-${item.language}`;
            const language = name(item.language);
            return (
              <section key={item.language} className="stack" aria-labelledby={`${id}-heading`}>
                <h4 id={`${id}-heading`}>{t('prep.translationHeading', { language })}</h4>
                <Field
                  id={`${id}-subject`}
                  name={`${field}.subject`}
                  label={t('prep.translationSubject', { language })}
                  defaultValue={sent.text(`${field}.subject`, item.subject)}
                />
                <TextArea
                  id={`${id}-body`}
                  name={`${field}.body`}
                  label={t('prep.translationBody', { language })}
                  defaultValue={sent.text(`${field}.body`, item.body)}
                  rows={10}
                />
              </section>
            );
          })
        : null}
    </div>
  );
}
