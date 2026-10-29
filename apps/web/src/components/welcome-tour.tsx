'use client';

import { useEffect, useRef, useState } from 'react';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';

export const TOUR_SEEN_COOKIE = 'thp_tour_seen';

const steps: readonly { readonly title: MessageKey; readonly body: MessageKey }[] = [
  { title: 'tour.welcomeTitle', body: 'tour.welcomeBody' },
  { title: 'tour.classesTitle', body: 'tour.classesBody' },
  { title: 'tour.semestersTitle', body: 'tour.semestersBody' },
  { title: 'tour.billingTitle', body: 'tour.billingBody' },
];

const tourSeen = () => document.cookie.split('; ').some((part) => part === `${TOUR_SEEN_COOKIE}=1`);

/**
 * A short welcome the first time this browser opens the dashboard. It is a modal dialog (Esc or
 * the close button ends it) and remembers that it was seen in a cookie, not in the database.
 */
export function WelcomeTour({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!tourSeen()) dialog.current?.showModal();
  }, []);

  const finish = () => {
    document.cookie = `${TOUR_SEEN_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
    dialog.current?.close();
  };

  const current = steps[step] ?? steps[0];
  if (current === undefined) return null;
  const last = step === steps.length - 1;
  return (
    <dialog ref={dialog} className="tour card" aria-labelledby="tour-title" onClose={finish}>
      <div className="stack">
        <p className="muted">{t('tour.stepOf', { current: step + 1, total: steps.length })}</p>
        <h2 id="tour-title">{t(current.title)}</h2>
        <p>{t(current.body)}</p>
        <div className="row-between">
          <button type="button" className="link-button" onClick={finish}>
            {t('tour.close')}
          </button>
          <div className="actions">
            {step > 0 ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setStep(step - 1);
                }}
              >
                {t('tour.back')}
              </button>
            ) : null}
            <button
              type="button"
              className="button"
              onClick={() => {
                if (last) finish();
                else setStep(step + 1);
              }}
              autoFocus
            >
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
