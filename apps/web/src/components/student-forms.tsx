'use client';

import { useActionState } from 'react';
import type { StudentQuestion } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { submitAnswersAction, type StudentFormState } from '../app/_lib/student-actions.ts';
import { FormAlert, Submit } from './forms.tsx';
import { Hidden } from './form-fields.tsx';

const initial: StudentFormState = {};

/** How a student answers one question, by its type. */
function Answer({
  locale,
  question,
}: {
  readonly locale: Locale;
  readonly question: StudentQuestion;
}) {
  const t = createTranslator(locale);
  const name = `q.${question.id}`;
  if (question.type === 'multiple_choice' || question.type === 'true_false') {
    const choices =
      question.type === 'true_false'
        ? [
            ['true', t('questions.true')],
            ['false', t('questions.false')],
          ]
        : question.options.map((option, index) => [String(index), option]);
    return (
      <div className="choices" role="radiogroup" aria-label={question.prompt}>
        {choices.map(([value, label]) => (
          <label key={value} className="checkbox">
            <input type="radio" name={name} value={value} /> {label}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === 'matching') {
    return (
      <div className="stack">
        {question.lefts.map((left) => (
          <div key={left} className="field">
            <label htmlFor={`${question.id}-${left}`}>{left}</label>
            <select id={`${question.id}-${left}`} name={`m.${question.id}.${left}`} defaultValue="">
              <option value="">{t('student.choose')}</option>
              {question.rights.map((right) => (
                <option key={right} value={right}>
                  {right}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }
  const long = question.type === 'essay' || question.type === 'short_answer';
  return long ? (
    <textarea name={name} rows={question.type === 'essay' ? 8 : 3} aria-label={question.prompt} />
  ) : (
    <input name={name} aria-label={question.prompt} autoComplete="off" />
  );
}

/** A student's answer form; once handed in, the page shows that it was. */
export function StudentAnswerForm(props: {
  readonly locale: Locale;
  readonly token: string;
  readonly assignmentId: string;
  readonly questions: readonly StudentQuestion[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(submitAnswersAction, initial);
  if (state.submitted === true) {
    return (
      <p role="status" className="notice">
        {t('student.submitted', { date: new Date().toLocaleDateString(props.locale) })}
      </p>
    );
  }
  return (
    <form action={action} className="stack" aria-label={t('student.submit')}>
      <Hidden
        values={{ locale: props.locale, token: props.token, assignmentId: props.assignmentId }}
      />
      <FormAlert
        message={state.errors === undefined ? undefined : Object.values(state.errors).join(' ')}
      />
      <ol className="question-list">
        {props.questions.map((question) => (
          <li key={question.id} className="card stack">
            {question.instructions === null ? null : (
              <p className="hint">{question.instructions}</p>
            )}
            <p>
              <strong>{question.prompt}</strong>{' '}
              <span className="muted small">
                {t('student.questionPoints', { points: question.points })}
              </span>
            </p>
            <Answer locale={props.locale} question={question} />
          </li>
        ))}
      </ol>
      <Submit label={t('student.submit')} />
    </form>
  );
}
