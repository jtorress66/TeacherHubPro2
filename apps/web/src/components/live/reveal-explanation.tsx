import { createTranslator, type Locale } from '@thp/i18n';

/** The teacher's "why" for the question just revealed, on the big screen and every phone. */
export function RevealExplanation(props: {
  readonly locale: Locale;
  readonly explanation: string | null;
}) {
  if (props.explanation === null) return null;
  const t = createTranslator(props.locale);
  return (
    <p className="reveal-explanation">
      <strong>{t('gamePlay.reviewWhy')}</strong> {props.explanation}
    </p>
  );
}
