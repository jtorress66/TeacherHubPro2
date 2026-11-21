'use client';

import { useActionState } from 'react';
import { spokenQuestion, type StudentQuestion } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  submitAnswersAction,
  submitPassAnswersAction,
  type StudentFormState,
} from '../app/_lib/student-actions.ts';
import { FormAlert, Submit } from './forms.tsx';
import { Hidden } from './form-fields.tsx';
import { ReadAloud } from './read-aloud.tsx';
import { prefill, type Prefill } from '../server/form-values.ts';

const initial: StudentFormState = {};

/** How a student answers one question, by its type. */
function Answer({
  locale,
  question,
  sent,
}: {
  readonly locale: Locale;
  readonly question: StudentQuestion;
  readonly sent: Prefill;
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
            <input
              type="radio"
              name={name}
              value={value}
              defaultChecked={sent.text(name) === value}
            />{' '}
            {label}
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
            <select
              id={`${question.id}-${left}`}
              name={`m.${question.id}.${left}`}
              defaultValue={sent.text(`m.${question.id}.${left}`, '')}
            >
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
    <textarea
      name={name}
      rows={question.type === 'essay' ? 8 : 3}
      aria-label={question.prompt}
      defaultValue={sent.text(name)}
    />
  ) : (
    <input
      name={name}
      aria-label={question.prompt}
      autoComplete="off"
      defaultValue={sent.text(name)}
    />
  );
}

/** A student's answer form; once handed in, the page shows that it was. */
export function StudentAnswerForm(props: {
  readonly locale: Locale;
  /** The student's link token; null for a student whose pass (a cookie) lets them in. */
  readonly token: string | null;
  readonly assignmentId: string;
  readonly questions: readonly StudentQuestion[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(
    props.token === null ? submitPassAnswersAction : submitAnswersAction,
    initial,
  );
  if (state.submitted === true) {
    return (
      <p role="status" className="notice">
        {t('student.submitted', { date: new Date().toLocaleDateString(props.locale) })}
      </p>
    );
  }
  const sent = prefill(state.values);
  return (
    <form action={action} className="stack" aria-label={t('student.submit')} key={sent.key}>
      <Hidden
        values={{
          locale: props.locale,
          ...(props.token === null ? {} : { token: props.token }),
          assignmentId: props.assignmentId,
        }}
      />
      <FormAlert
        message={state.errors === undefined ? undefined : Object.values(state.errors).join(' ')}
      />
      <ol className="question-list">
        {props.questions.map((question, index) => (
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
            <p>
              <ReadAloud
                locale={props.locale}
                language={props.locale}
                text={spokenQuestion(question, {
                  true: t('questions.true'),
                  false: t('questions.false'),
                })}
                context={t('student.listenQuestion', { number: index + 1 })}
              />
            </p>
            <Answer locale={props.locale} question={question} sent={sent} />
          </li>
        ))}
      </ol>
      <Submit label={t('student.submit')} />
    </form>
  );
}
