'use client';

import { useActionState } from 'react';
import { weekdays, type Class, type Semester, type Student } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  addStudentAction,
  createClassAction,
  createSemesterAction,
  importStudentsAction,
  updateClassAction,
  updateSemesterAction,
  updateStudentAction,
  type RosterFormState,
} from '../app/_lib/roster-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: RosterFormState = {};

function Notice({ message }: { readonly message?: string | null | false | undefined }) {
  return message ? (
    <p role="status" className="notice">
      {message}
    </p>
  ) : null;
}

/** Create a class, or edit one when `cls` is given. */
export function ClassForm(props: {
  readonly locale: Locale;
  readonly semesters: readonly Pick<Semester, 'id' | 'name'>[];
  readonly cls?: Class;
}) {
  const t = createTranslator(props.locale);
  const { cls } = props;
  const [state, action] = useActionState(cls ? updateClassAction : createClassAction, initial);
  const days = cls?.schedule?.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={cls ? t('classes.save') : t('classes.newClass')}
    >
      <input type="hidden" name="locale" value={props.locale} />
      {cls ? <input type="hidden" name="classId" value={cls.id} /> : null}
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('classes.name')}
        name="name"
        defaultValue={cls?.name}
        error={state.errors?.name}
        required
      />
      <div className="field-row">
        <Field
          label={t('classes.subject')}
          name="subject"
          defaultValue={cls?.subject}
          error={state.errors?.subject}
        />
        <Field
          label={t('classes.grade')}
          name="grade"
          defaultValue={cls?.grade}
          error={state.errors?.grade}
        />
        <Field
          label={t('classes.section')}
          name="section"
          defaultValue={cls?.section}
          error={state.errors?.section}
        />
      </div>
      <div className="field-row">
        <Field
          label={t('classes.schoolYear')}
          name="schoolYear"
          defaultValue={cls?.schoolYear}
          error={state.errors?.schoolYear}
        />
        <div className="field">
          <label htmlFor="semesterId">{t('classes.semester')}</label>
          <select id="semesterId" name="semesterId" defaultValue={cls?.semesterId ?? ''}>
            <option value="">{t('classes.noSemester')}</option>
            {props.semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="stack">
        <legend>{t('classes.schedule')}</legend>
        <div className="field-row">
          <Field
            label={t('classes.period')}
            name="period"
            type="number"
            min={1}
            defaultValue={cls?.schedule?.period}
            error={state.errors?.period}
          />
          <Field
            label={t('classes.startTime')}
            name="startTime"
            type="time"
            defaultValue={cls?.schedule?.startTime}
            error={state.errors?.startTime}
          />
          <Field
            label={t('classes.endTime')}
            name="endTime"
            type="time"
            defaultValue={cls?.schedule?.endTime}
            error={state.errors?.endTime}
          />
        </div>
        <fieldset className="days">
          <legend>{t('classes.days')}</legend>
          {weekdays.map((day) => (
            <label key={day} className="checkbox">
              <input type="checkbox" name="days" value={day} defaultChecked={days.includes(day)} />
              {t(`weekdays.${day}`)}
            </label>
          ))}
        </fieldset>
        {state.errors?.days ? <p className="field-error">{state.errors.days}</p> : null}
      </fieldset>
      <Notice message={state.saved && t('classes.saved')} />
      <Submit label={cls ? t('classes.save') : t('classes.create')} />
    </form>
  );
}

function StudentFields(props: {
  readonly locale: Locale;
  readonly state: RosterFormState;
  readonly student?: Student;
}) {
  const t = createTranslator(props.locale);
  const { state, student } = props;
  return (
    <>
      <div className="field-row">
        <Field
          label={t('students.firstName')}
          name="firstName"
          defaultValue={student?.firstName}
          error={state.errors?.firstName}
          required
        />
        <Field
          label={t('students.lastName')}
          name="lastName"
          defaultValue={student?.lastName}
          error={state.errors?.lastName}
          required
        />
      </div>
      <div className="field-row">
        <Field
          label={t('students.studentNumber')}
          name="studentNumber"
          defaultValue={student?.studentNumber}
          error={state.errors?.studentNumber ?? state.errors?.form}
        />
        <Field
          label={t('students.parentEmail')}
          name="parentEmail"
          type="email"
          defaultValue={student?.parentEmail}
          error={state.errors?.parentEmail}
        />
      </div>
      <Field
        label={t('students.accommodations')}
        name="accommodations"
        defaultValue={student?.accommodations}
        error={state.errors?.accommodations}
      />
    </>
  );
}

export function AddStudentForm({
  locale,
  classId,
}: {
  readonly locale: Locale;
  readonly classId: string;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(addStudentAction, initial);
  return (
    <form
      key={state.version ?? 0}
      action={action}
      className="stack"
      noValidate
      aria-label={t('students.add')}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />
      <StudentFields locale={locale} state={state} />
      <Submit label={t('students.add')} />
    </form>
  );
}

export function EditStudentForm({
  locale,
  student,
}: {
  readonly locale: Locale;
  readonly student: Student;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(updateStudentAction, initial);
  return (
    <form action={action} className="stack" noValidate aria-label={t('students.editTitle')}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="studentId" value={student.id} />
      <StudentFields locale={locale} state={state} student={student} />
      <Submit label={t('students.save')} />
    </form>
  );
}

export function ImportStudentsForm({
  locale,
  classId,
}: {
  readonly locale: Locale;
  readonly classId: string;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(importStudentsAction, initial);
  return (
    <form
      key={state.version ?? 0}
      action={action}
      className="stack"
      aria-label={t('students.importTitle')}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />
      <p className="muted">{t('students.importHelp')}</p>
      <p>
        <a href={`/samples/students-${locale === 'es' ? 'es' : 'en'}.csv`} download>
          {t('students.sample')}
        </a>
      </p>
      <div className="field">
        <label htmlFor="file">{t('students.file')}</label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required />
      </div>
      {state.messages && state.messages.length > 0 ? (
        <ul role="alert" className="alert error-list">
          {state.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
      <Notice
        message={state.imported !== undefined && t('students.imported', { count: state.imported })}
      />
      <Submit label={t('students.import')} />
    </form>
  );
}

/** Create a semester, or edit one when `semester` is given. */
export function SemesterForm({
  locale,
  semester,
}: {
  readonly locale: Locale;
  readonly semester?: Semester;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(
    semester ? updateSemesterAction : createSemesterAction,
    initial,
  );
  return (
    <form
      key={semester ? semester.id : String(state.saved ?? false)}
      action={action}
      className="stack"
      noValidate
      aria-label={semester ? t('semesters.editTitle') : t('semesters.newSemester')}
    >
      <input type="hidden" name="locale" value={locale} />
      {semester ? <input type="hidden" name="semesterId" value={semester.id} /> : null}
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('semesters.name')}
        name="name"
        defaultValue={semester?.name}
        error={state.errors?.name}
        required
      />
      <div className="field-row">
        <Field
          label={t('semesters.startDate')}
          name="startDate"
          type="date"
          defaultValue={semester?.startDate}
          error={state.errors?.startDate}
          required
        />
        <Field
          label={t('semesters.endDate')}
          name="endDate"
          type="date"
          defaultValue={semester?.endDate}
          error={state.errors?.endDate}
          required
        />
        <Field
          label={t('semesters.schoolYear')}
          name="schoolYear"
          defaultValue={semester?.schoolYear}
          error={state.errors?.schoolYear}
        />
      </div>
      {semester ? null : (
        <label className="checkbox">
          <input type="checkbox" name="makeActive" /> {t('semesters.makeActive')}
        </label>
      )}
      <Submit label={semester ? t('semesters.save') : t('semesters.create')} />
    </form>
  );
}
