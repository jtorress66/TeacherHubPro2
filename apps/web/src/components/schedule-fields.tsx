'use client';

import { useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { Field } from './forms.tsx';
import { prefill, type Prefill } from '../server/form-values.ts';

/** "Post now" or "Schedule for later" with a date and time, in the teacher's time zone. */
export function ScheduleFields(props: {
  readonly locale: Locale;
  readonly idPrefix: string;
  readonly error: string | undefined;
  /** What was sent last, when the form came back with an error. */
  readonly sent?: Prefill;
}) {
  const t = createTranslator(props.locale);
  const sent = props.sent ?? prefill(undefined);
  const [later, setLater] = useState(sent.text('when') === 'later');
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
            defaultValue={sent.text('scheduleDate')}
            error={props.error}
          />
          <Field
            id={`${props.idPrefix}-schedule-time`}
            name="scheduleTime"
            type="time"
            label={t('schedule.time')}
            defaultValue={sent.text('scheduleTime')}
          />
        </div>
      ) : null}
      {later ? <p className="hint">{t('schedule.hint')}</p> : null}
    </fieldset>
  );
}
