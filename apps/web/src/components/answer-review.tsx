import type { AnswerDescription, QuestionScore } from '@thp/domain';
import type { Locale, Translate } from '@thp/i18n';
import { answerLines, scoreSummary, type Mark } from '../server/grading-review.ts';

const symbols: Readonly<Record<Mark, string>> = { correct: '✓', incorrect: '✗' };

/** ✓ or ✗, with the word for screen readers (unless the word is already shown). */
function MarkSymbol(props: {
  readonly mark: Mark;
  readonly t: Translate;
  readonly spoken: boolean;
}) {
  return (
    <>
      <span aria-hidden="true">{symbols[props.mark]}</span>
      {props.spoken ? (
        <span className="visually-hidden">{props.t(`grading.${props.mark}`)}</span>
      ) : null}
    </>
  );
}

/** A student's answer as the teacher reads it: the option picked, each pair, the right answer. */
export function AnswerReview(props: {
  readonly description: AnswerDescription;
  readonly t: Translate;
}) {
  return (
    <>
      {answerLines(props.description, props.t).map((line, index) => (
        <span key={index} className={line.hint ? 'hint answer-line' : 'answer-line'}>
          {line.text}
          {line.hidden === undefined ? null : (
            <span className="visually-hidden"> ({line.hidden})</span>
          )}
          {line.mark === null ? null : (
            <>
              {' '}
              <MarkSymbol mark={line.mark} t={props.t} spoken />
            </>
          )}
        </span>
      ))}
    </>
  );
}

/** "✓ Correct · 1 of 1 point (scored automatically) · feedback". */
export function ScoreLine(props: {
  readonly scored: QuestionScore;
  readonly points: number;
  readonly t: Translate;
  readonly locale: Locale;
}) {
  const { verdict, points, source } = scoreSummary(
    props.scored,
    props.points,
    props.t,
    props.locale,
  );
  return (
    <span className="muted small answer-line">
      {verdict === null ? null : (
        <>
          <MarkSymbol mark={verdict} t={props.t} spoken={false} /> {props.t(`grading.${verdict}`)}{' '}
          ·{' '}
        </>
      )}
      {points} ({source}){props.scored.feedback === null ? '' : ` · ${props.scored.feedback}`}
    </span>
  );
}
