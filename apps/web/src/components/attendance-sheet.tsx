'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { attendanceStatuses, type AttendanceStatus } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { saveAttendanceAction, type AttendanceFormState } from '../app/_lib/attendance-actions.ts';
import { FormAlert } from './forms.tsx';

export interface SheetRowView {
  readonly id: string;
  readonly name: string;
  readonly status: AttendanceStatus;
  readonly minutesLate: number | null;
  readonly note: string | null;
}

const initial: AttendanceFormState = {};

function SheetButtons({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const { pending } = useFormStatus();
  return (
    <div className="actions">
      <button
        type="submit"
        name="intent"
        value="save"
        className="button secondary"
        disabled={pending}
      >
        {t('attendance.save')}
      </button>
      <button type="submit" name="intent" value="submit" className="button" disabled={pending}>
        {t('attendance.submit')}
      </button>
    </div>
  );
}

/** The editable sheet: a status per student, minutes late for tardies, a note, Save and Submit. */
export function AttendanceSheetForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly date: string;
  readonly rows: readonly SheetRowView[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveAttendanceAction, initial);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(props.rows.map((row) => [row.id, row.status])),
  );
  const markAllPresent = () => {
    setStatuses(Object.fromEntries(props.rows.map((row) => [row.id, 'present' as const])));
  };
  const errors = state.errors ?? {};

  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="classId" value={props.classId} />
      <input type="hidden" name="date" value={props.date} />
      <FormAlert message={errors.form} />
      {state.done ? (
        <p role="status" className="notice">
          {t(state.done === 'submitted' ? 'attendance.submitted' : 'attendance.saved')}
        </p>
      ) : null}
      <div>
        <button type="button" className="button secondary" onClick={markAllPresent}>
          {t('attendance.markAllPresent')}
        </button>
      </div>
      <table className="roster attendance-sheet">
        <thead>
          <tr>
            <th scope="col">{t('attendance.student')}</th>
            <th scope="col">{t('attendance.status')}</th>
            <th scope="col">{t('attendance.minutesLate')}</th>
            <th scope="col">{t('attendance.note')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const status = statuses[row.id] ?? row.status;
            const lateError = errors[`minutesLate.${row.id}`];
            const noteError = errors[`note.${row.id}`];
            return (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td>
                  <fieldset className="status-choices">
                    <legend className="visually-hidden">
                      {t('attendance.statusFor', { name: row.name })}
                    </legend>
                    {attendanceStatuses.map((choice) => (
                      <label key={choice}>
                        <input
                          type="radio"
                          name={`status.${row.id}`}
                          value={choice}
                          checked={status === choice}
                          onChange={() => {
                            setStatuses((current) => ({ ...current, [row.id]: choice }));
                          }}
                        />{' '}
                        {t(`attendance.status_${choice}`)}
                      </label>
                    ))}
                  </fieldset>
                </td>
                <td>
                  {status === 'tardy' ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={240}
                        name={`minutesLate.${row.id}`}
                        defaultValue={row.minutesLate ?? undefined}
                        aria-label={t('attendance.minutesLateFor', { name: row.name })}
                        aria-invalid={lateError ? true : undefined}
                        className="minutes"
                      />
                      {lateError ? <p className="field-error">{lateError}</p> : null}
                    </>
                  ) : null}
                </td>
                <td>
                  <input
                    type="text"
                    maxLength={200}
                    name={`note.${row.id}`}
                    defaultValue={row.note ?? undefined}
                    aria-label={t('attendance.noteFor', { name: row.name })}
                    aria-invalid={noteError ? true : undefined}
                  />
                  {noteError ? <p className="field-error">{noteError}</p> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SheetButtons locale={props.locale} />
    </form>
  );
}
