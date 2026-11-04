'use client';

import { useState, useTransition } from 'react';
import type { CheckResult } from '@thp/application';
import type { LearnerCheck } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { submitLessonCheckAction } from '../../app/_lib/learning-actions.ts';

/**
 * A lesson's check on the student's device: big option buttons, then the server's score and the
 * right answers to what was missed. The answers never reach the browser before submitting.
 */
export function LessonCheck(props: {
  readonly locale: Locale;
  readonly token: string;
  readonly pathId: string;
  readonly lesson: number;
  readonly checks: readonly LearnerCheck[];
  readonly nextHref: string | null;
  readonly backHref: string;
}) {
  const t = createTranslator(props.locale);
  const empty = props.checks.map(() => null);
  const [answers, setAnswers] = useState<readonly (number | null)[]>(empty);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    startTransition(async () => {
      const reply = await submitLessonCheckAction(props.token, {
        pathId: props.pathId,
        lesson: props.lesson,
        answers: [...answers],
      });
      setFailed(!reply.ok);
      if (reply.ok) setResult(reply.result);
    });
  };

  if (result !== null) {
    return (
      <div className="stack">
        <p role="status" className="notice live-standing">
          {t('learning.score', {
            score: result.score,
            total: result.total,
            percent: result.percent,
          })}
        </p>
        {result.corrections.length === 0 ? (
          <p>{t('learning.allRight')}</p>
        ) : (
          <ul className="list" aria-label={t('learning.checkTitle')}>
            {result.corrections.map((c) => (
              <li key={c.check}>{t('learning.correction', { n: c.check + 1, right: c.right })}</li>
            ))}
          </ul>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setAnswers(empty);
              setResult(null);
            }}
          >
            {t('learning.tryAgain')}
          </button>
          {props.nextHref === null ? (
            <a className="button" href={props.backHref}>
              {t('learning.backToPath')}
            </a>
          ) : (
            <a className="button" href={props.nextHref}>
              {t('learning.nextLesson')}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className="stack"
      aria-label={t('learning.checkTitle')}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {failed ? (
        <p role="alert" className="alert">
          {t('student.notFound')}
        </p>
      ) : null}
      {props.checks.map((check, c) => (
        <fieldset key={c} className="stack">
          <legend className="lesson-question">
            {c + 1}. {check.prompt}
          </legend>
          <div className="answer-grid">
            {check.options.map((option, o) => (
              <button
                key={o}
                type="button"
                className={`answer answer-${String(o % 6)}${answers[c] === o ? ' right' : ''}`}
                aria-pressed={answers[c] === o}
                onClick={() => {
                  setAnswers(answers.map((a, i) => (i === c ? o : a)));
                }}
              >
                <span className="answer-text">{option}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="button-row">
        <button type="submit" className="button accent large" disabled={pending}>
          {t('learning.submit')}
        </button>
      </div>
    </form>
  );
}
