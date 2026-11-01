'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuizView, TimeAttackView, TrueFalseView } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import type { RendererProps } from './renderer.ts';

/** One question at a time; each click answers and moves on. */
function OneAtATime(props: {
  readonly total: number;
  readonly locale: RendererProps<QuizView>['locale'];
  readonly prompt: (index: number) => string;
  readonly choices: (index: number) => readonly { label: string; value: unknown }[];
  readonly onDone: (answers: unknown[]) => void;
  /** Called with the answers so far after each one. */
  readonly onAnswer?: (answers: unknown[]) => void;
}) {
  const t = createTranslator(props.locale);
  const [index, setIndex] = useState(0);
  const answers = useRef<unknown[]>([]);
  if (index >= props.total) return null;
  return (
    <div className="stack game-question">
      <p className="muted small">{t('gamePlay.progress', { n: index + 1, total: props.total })}</p>
      <h2>{props.prompt(index)}</h2>
      <div className="button-row">
        {props.choices(index).map((choice) => (
          <button
            key={choice.label}
            type="button"
            className="button secondary"
            onClick={() => {
              answers.current = [...answers.current, choice.value];
              props.onAnswer?.(answers.current);
              if (index + 1 === props.total) props.onDone(answers.current);
              else setIndex(index + 1);
            }}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QuizRound({ view, locale, onDone }: RendererProps<QuizView>) {
  return (
    <OneAtATime
      locale={locale}
      total={view.questions.length}
      prompt={(i) => view.questions[i]?.prompt ?? ''}
      choices={(i) => (view.questions[i]?.options ?? []).map((label, value) => ({ label, value }))}
      onDone={onDone}
    />
  );
}

/** A quiz against the clock: when time runs out, the answers so far are sent. */
export function TimeAttackRound({ view, locale, onDone }: RendererProps<TimeAttackView>) {
  const t = createTranslator(locale);
  const [left, setLeft] = useState(view.seconds);
  const answers = useRef<unknown[]>([]);
  const finished = useRef(false);
  const finish = (given: unknown[]) => {
    if (finished.current) return;
    finished.current = true;
    onDone(given);
  };
  useEffect(() => {
    const timer = setInterval(() => {
      setLeft((seconds) => seconds - 1);
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (left <= 0) finish(answers.current);
  });
  return (
    <div className="stack">
      <p className="chip" role="timer">
        {t('gamePlay.timeLeft', { seconds: Math.max(0, left) })}
      </p>
      <OneAtATime
        locale={locale}
        total={view.questions.length}
        prompt={(i) => view.questions[i]?.prompt ?? ''}
        choices={(i) =>
          (view.questions[i]?.options ?? []).map((label, value) => ({ label, value }))
        }
        onDone={finish}
        onAnswer={(given) => {
          answers.current = given;
        }}
      />
    </div>
  );
}

export function TrueFalseRound({ view, locale, onDone }: RendererProps<TrueFalseView>) {
  const t = createTranslator(locale);
  return (
    <OneAtATime
      locale={locale}
      total={view.statements.length}
      prompt={(i) => view.statements[i] ?? ''}
      choices={() => [
        { label: t('gamePlay.true'), value: true },
        { label: t('gamePlay.false'), value: false },
      ]}
      onDone={onDone}
    />
  );
}
