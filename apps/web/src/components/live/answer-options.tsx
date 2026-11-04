'use client';

import type { LiveQuestion } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/** One color and shape per option, so answers are easy to tell apart from across the room. */
const shapes = ['▲', '◆', '●', '■', '★', '⬟'];

export function optionLabel(question: LiveQuestion, option: number, locale: Locale): string {
  const t = createTranslator(locale);
  const text = question.options[option] ?? '';
  return question.style === 'true_false'
    ? t(text === 'true' ? 'gamePlay.true' : 'gamePlay.false')
    : text;
}

/**
 * The options as large colored tiles: buttons for players, a display (with counts and the right
 * answer marked) for the host.
 */
export function AnswerOptions(props: {
  readonly locale: Locale;
  readonly question: LiveQuestion;
  readonly onChoose?: (option: number) => void;
  readonly correct?: number | null;
  readonly counts?: readonly number[] | null;
}) {
  const t = createTranslator(props.locale);
  return (
    <div className="answer-grid">
      {props.question.options.map((_, option) => {
        const label = optionLabel(props.question, option, props.locale);
        const marked =
          props.correct === undefined || props.correct === null
            ? ''
            : option === props.correct
              ? ' right'
              : ' faded';
        const content = (
          <>
            <span className="answer-shape" aria-hidden="true">
              {shapes[option] ?? '●'}
            </span>
            <span className="answer-text">{label}</span>
            {props.counts ? (
              <span className="answer-count">{props.counts[option] ?? 0}</span>
            ) : null}
          </>
        );
        return props.onChoose ? (
          <button
            key={option}
            type="button"
            className={`answer answer-${String(option)}${marked}`}
            aria-label={t('play.chooseAnswer', { n: option + 1, option: label })}
            onClick={() => {
              props.onChoose?.(option);
            }}
          >
            {content}
          </button>
        ) : (
          <div key={option} className={`answer answer-${String(option)}${marked}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
