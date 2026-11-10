import { createTranslator, type Locale } from '@thp/i18n';
import { getAppContainer } from '../container.ts';
import { includedFeatures, softwareApplicationData } from '../server/site-facts.ts';

/** The app's facts for search engines, as schema.org structured data. */
export function StructuredData({ locale }: { readonly locale: Locale }) {
  const data = softwareApplicationData(getAppContainer().appUrl, locale);
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with "<" escaped cannot close the script element.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

/** Every feature in one list, so readers and search engines see all of it on one page. */
export function IncludedList({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <section className="m-section" aria-labelledby="included-title">
      <h2 id="included-title">{t('marketing.included.title')}</h2>
      <p>{t('marketing.included.intro')}</p>
      <ul className="m-included">
        {includedFeatures.map((key) => (
          <li key={key}>{t(`marketing.included.${key}`)}</li>
        ))}
      </ul>
    </section>
  );
}
