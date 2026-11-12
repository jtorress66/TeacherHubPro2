'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  makeCalendarLinkAction,
  turnOffCalendarLinkAction,
  type CalendarLinkState,
} from '../app/_lib/calendar-actions.ts';
import { CopyLink } from './assignment-tools.tsx';
import { FormAlert } from './forms.tsx';

const initial: CalendarLinkState = {};

/**
 * The Settings card for the calendar subscription link: make one, see it once with the steps to
 * add it to Google Calendar, Outlook or Apple Calendar, replace it, or turn it off.
 */
export function CalendarLinkCard({
  locale,
  active,
}: {
  readonly locale: Locale;
  readonly active: boolean;
}) {
  const t = createTranslator(locale);
  const [state, make] = useActionState(makeCalendarLinkAction, initial);
  // Shown only while the link is on: once turned off, the address no longer works.
  const url = active ? state.url : undefined;
  return (
    <section className="card stack" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading">{t('calendarFeed.title')}</h2>
      <p className="muted">{t('calendarFeed.intro')}</p>
      <FormAlert message={state.error} />
      {url === undefined ? null : (
        <section className="stack" aria-labelledby="calendar-made-heading">
          <h3 id="calendar-made-heading">{t('calendarFeed.madeTitle')}</h3>
          <p className="notice">{t('calendarFeed.madeNote')}</p>
          <div className="field">
            <label htmlFor="calendar-link">{t('calendarFeed.linkLabel')}</label>
            <input
              id="calendar-link"
              type="text"
              readOnly
              value={url}
              onFocus={(event) => {
                event.currentTarget.select();
              }}
            />
          </div>
          <p>
            <CopyLink locale={locale} url={url} />
          </p>
          <h3>{t('calendarFeed.stepsTitle')}</h3>
          <ul>
            <li>{t('calendarFeed.google')}</li>
            <li>{t('calendarFeed.outlook')}</li>
            <li>{t('calendarFeed.apple')}</li>
          </ul>
          <p className="hint">{t('calendarFeed.delay')}</p>
        </section>
      )}
      {active && url === undefined ? <p>{t('calendarFeed.active')}</p> : null}
      <div className="button-row">
        <form action={make}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={active ? 'button secondary' : 'button'}>
            {active ? t('calendarFeed.newLink') : t('calendarFeed.make')}
          </button>
        </form>
        {active ? (
          <form action={turnOffCalendarLinkAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="button secondary">
              {t('calendarFeed.turnOff')}
            </button>
          </form>
        ) : null}
      </div>
      {active ? <p className="hint">{t('calendarFeed.newLinkNote')}</p> : null}
      <p className="hint">{t('calendarFeed.privacy')}</p>
    </section>
  );
}
