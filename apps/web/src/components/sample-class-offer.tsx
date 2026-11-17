import { createTranslator, type Locale } from '@thp/i18n';
import { addSampleClassAction } from '../app/_lib/roster-actions.ts';

/** The one-click invitation to try the app on a class of made-up students. */
export function SampleClassOffer(props: { readonly locale: Locale }) {
  const t = createTranslator(props.locale);
  return (
    <section className="card stack sample-offer" aria-labelledby="sample-offer-heading">
      <h2 id="sample-offer-heading">{t('sample.tryTitle')}</h2>
      <p>{t('sample.tryText')}</p>
      <form action={addSampleClassAction}>
        <input type="hidden" name="locale" value={props.locale} />
        <button type="submit" className="button">
          {t('sample.add')}
        </button>
      </form>
    </section>
  );
}
