'use client';

import { useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { Field } from './forms.tsx';

/** "Post now" or "Schedule for later" with a date and time, in the teacher's time zone. */
export function ScheduleFields(props: {
  readonly locale: Locale;
  readonly idPrefix: string;
  readonly error: string | undefined;
}) {
  const t = createTranslator(props.locale);
  const [later, setLater] = useState(false);
  return (
    <fieldset className="stack">
      <legend>{t('schedule.when')}</legend>
      <label className="checkbox">
        <input
          type="radio"
          name="when"
          value="now"
          checked={!later}
          onChange={() => {
            setLater(false);
          }}
        />{' '}
        {t('schedule.now')}
      </label>
      <label className="checkbox">
        <input
          type="radio"
          name="when"
          value="later"
          checked={later}
          onChange={() => {
            setLater(true);
          }}
        />{' '}
        {t('schedule.later')}
      </label>
      {later ? (
        <div className="field-row">
          <Field
            id={`${props.idPrefix}-schedule-date`}
            name="scheduleDate"
            type="date"
            label={t('schedule.date')}
            error={props.error}
          />
          <Field
            id={`${props.idPrefix}-schedule-time`}
            name="scheduleTime"
            type="time"
            label={t('schedule.time')}
          />
        </div>
      ) : null}
      {later ? <p className="hint">{t('schedule.hint')}</p> : null}
    </fieldset>
  );
}
