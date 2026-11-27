import type { ReviewAnswer, RoundReviewItem } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

const answerText = (answer: ReviewAnswer, t: ReturnType<typeof createTranslator>): string =>
  'text' in answer ? answer.text : t(answer.truth ? 'gamePlay.true' : 'gamePlay.false');

/**
 * The items a student missed, after the round: what they answered, the right answer and why.
 * When the game's grade keeps the best try, the answers are hidden and a note says so.
 */
export function RoundReview(props: {
  readonly locale: Locale;
  readonly items: readonly RoundReviewItem[];
}) {
  const t = createTranslator(props.locale);
  if (props.items.length === 0) return null;
  const hidden = props.items.every((item) => item.right === null);
  return (
    <section className="stack round-review" aria-labelledby="round-review-heading">
      <h2 id="round-review-heading">{t('gamePlay.reviewTitle')}</h2>
      {hidden ? <p className="hint">{t('gamePlay.reviewHidden')}</p> : null}
      <ol className="round-review-list">
        {props.items.map((item, index) => (
          <li key={index} className="card stack">
            <p className="round-review-prompt">{item.prompt}</p>
            <p>
              {item.given === null
                ? t('gamePlay.reviewNoAnswer')
                : t('gamePlay.reviewYours', { answer: answerText(item.given, t) })}
            </p>
            {item.right === null ? null : (
              <p className="round-review-right">
                {t('gamePlay.reviewRight', { answer: answerText(item.right, t) })}
              </p>
            )}
            {item.explanation === null ? null : (
              <p className="round-review-why">
                <strong>{t('gamePlay.reviewWhy')}</strong> {item.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
