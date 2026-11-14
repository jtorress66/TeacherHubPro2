import type { AnswerDescription, QuestionScore } from '@thp/domain';
import type { Locale, Translate } from '@thp/i18n';

export type Mark = 'correct' | 'incorrect';

/** One line of a student's answer as the teacher reads it. */
export interface ReviewLine {
  readonly text: string;
  readonly mark: Mark | null;
  /** A note under the answer, such as the correct option. */
  readonly hint: boolean;
  /** Words for screen readers only, where the text shows a symbol. */
  readonly hidden?: string;
}

type DescriptionOf<K extends AnswerDescription['kind']> = Extract<AnswerDescription, { kind: K }>;
type Lines<K extends AnswerDescription['kind']> = (
  description: DescriptionOf<K>,
  t: Translate,
) => readonly ReviewLine[];

const markFor = (correct: boolean): Mark => (correct ? 'correct' : 'incorrect');
const line = (text: string, mark: Mark | null = null): ReviewLine => ({ text, mark, hint: false });
const hint = (text: string): ReviewLine => ({ text, mark: null, hint: true });

/** How each kind of answer reads. A new kind adds an entry here. */
const lineRules: { readonly [K in AnswerDescription['kind']]: Lines<K> } = {
  unanswered: (_d, t) => [line(t('grading.noAnswer'))],
  choice: (d, t) => [
    line(`${d.letter}. ${d.text}`, markFor(d.correct)),
    ...(d.correct
      ? []
      : [hint(t('grading.correctAnswer', { answer: `${d.correctLetter}. ${d.correctText}` }))]),
  ],
  truefalse: (d, t) => [
    line(t(d.value ? 'questions.true' : 'questions.false'), markFor(d.correct)),
  ],
  blank: (d, t) => [
    line(d.text, markFor(d.correct)),
    ...(d.correct ? [] : [hint(t('grading.acceptedAnswers', { answers: d.accepted.join(', ') }))]),
  ],
  matching: (d, t) =>
    d.pairs.map((pair) =>
      pair.right === null
        ? { ...line(`${pair.left} → —`, 'incorrect'), hidden: t('grading.notMatched') }
        : line(`${pair.left} → ${pair.right}`, markFor(pair.correct)),
    ),
  text: (d) => [line(d.text)],
};

/** A described answer as lines for the review page. */
export function answerLines(description: AnswerDescription, t: Translate): readonly ReviewLine[] {
  const rule = lineRules[description.kind] as Lines<AnswerDescription['kind']>;
  return rule(description, t);
}

export interface ScoreSummary {
  /** Right or wrong, only for answers code scored all or nothing. */
  readonly verdict: Mark | null;
  readonly points: string;
  readonly source: string;
}

/** "✓ Correct · 1 of 1 point (scored automatically)", in parts for the page to lay out. */
export function scoreSummary(
  scored: Pick<QuestionScore, 'score' | 'source'>,
  points: number,
  t: Translate,
  locale: Locale,
): ScoreSummary {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const verdict =
    scored.source !== 'auto'
      ? null
      : scored.score >= points
        ? 'correct'
        : scored.score <= 0
          ? 'incorrect'
          : null;
  return {
    verdict,
    points: t(points === 1 ? 'grading.pointsOfOne' : 'grading.pointsOf', {
      score: number.format(scored.score),
      points: number.format(points),
    }),
    source: t(`grading.source_${scored.source}`),
  };
}
