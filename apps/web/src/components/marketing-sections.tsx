import Link from 'next/link';
import { planIds, trialDays } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { planName, planPrice } from '../server/plan-display.ts';
import { useCaseSlugs } from '../server/marketing-pages.ts';
import { MarketingArt, type ArtName } from './marketing-art.tsx';

/** The features the site shows as cards, each with a page to read more. */
const featureCards: readonly { key: ArtName; href: string }[] = [
  { key: 'lesson_planner', href: '/features/lesson-planning' },
  { key: 'ai_assistant', href: '/features/ai-tools' },
  { key: 'presentations', href: '/features/presentations' },
  { key: 'gradebook', href: '/features/gradebook' },
  { key: 'attendance', href: '/features/attendance' },
  { key: 'assignments', href: '/features/ai-tools' },
  { key: 'games', href: '/ai' },
  { key: 'learning', href: '/ai' },
  { key: 'families', href: '/features/workflow' },
  { key: 'command_center', href: '/features/workflow' },
  { key: 'prep_agent', href: '/features/workflow' },
  { key: 'schools', href: '/enterprise' },
];

type FeatureKey =
  | 'lesson_planner'
  | 'ai_assistant'
  | 'presentations'
  | 'gradebook'
  | 'attendance'
  | 'assignments'
  | 'games'
  | 'learning'
  | 'families'
  | 'command_center'
  | 'prep_agent'
  | 'schools';

export function FeatureGrid({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ul className="m-grid">
      {featureCards.map(({ key, href }) => {
        const feature = key as FeatureKey;
        const title = t(`marketing.feature.${feature}.title`);
        return (
          <li key={key} className="card m-card">
            <MarketingArt name={key} />
            <h3>{title}</h3>
            <p>{t(`marketing.feature.${feature}.text`)}</p>
            <Link href={`/${locale}${href}`}>
              {t('marketing.featuresPage.learnMore', { feature: title })}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const useCaseArt: Readonly<Record<(typeof useCaseSlugs)[number], ArtName>> = {
  'classroom-teachers': 'lesson_planner',
  homeschool: 'families',
  tutors: 'learning',
  schools: 'schools',
};

export function UseCaseCards({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ul className="m-grid m-grid-4">
      {useCaseSlugs.map((slug) => (
        <li key={slug} className="card m-card">
          <MarketingArt name={useCaseArt[slug]} />
          <h3>
            <Link href={`/${locale}/use-cases/${slug}`}>
              {t(`marketing.useCases.${slug}.title`)}
            </Link>
          </h3>
          <p>{t(`marketing.useCases.${slug}.description`)}</p>
        </li>
      ))}
    </ul>
  );
}

/** Every plan with its catalog price: the only prices the site states. */
export function PlanCards({ locale, full }: { readonly locale: Locale; readonly full: boolean }) {
  const t = createTranslator(locale);
  return (
    <ul className="m-grid m-grid-4" aria-label={t('marketing.nav.pricing')}>
      {planIds.map((id) => (
        <li key={id} className="card m-card m-plan" data-testid={`plan-${id}`}>
          <h3>{planName(id, locale)}</h3>
          <p className="m-price">{planPrice(id, locale)}</p>
          {full && (id === 'school' || id === 'district') ? (
            <p className="hint">
              {t('marketing.pricingPage.minimum', { count: id === 'school' ? 10 : 100 })}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Faq(props: {
  readonly title: string;
  readonly items: readonly { readonly q: string; readonly a: string }[];
}) {
  return (
    <section className="m-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">{props.title}</h2>
      <div className="m-faq">
        {props.items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function TrialCta({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <section className="m-section m-cta card" aria-labelledby="cta-heading">
      <h2 id="cta-heading">{t('marketing.landing.ctaTitle')}</h2>
      <p>{t('marketing.landing.ctaText')}</p>
      <p className="hint">{t('marketing.landing.pricingIntro', { days: trialDays })}</p>
      <p>
        <Link href={`/${locale}/signup`} className="button accent large">
          {t('marketing.nav.startTrial')}
        </Link>
      </p>
    </section>
  );
}

/** A simple page with a title, an introduction and the page's content below. */
export function PageIntro(props: { readonly title: string; readonly intro: string }) {
  return (
    <section className="m-section m-intro">
      <h1>{props.title}</h1>
      <p className="tagline">{props.intro}</p>
    </section>
  );
}

/** Numbered titled points, as on feature and use-case pages. */
export function Points(props: {
  readonly items: readonly {
    readonly title: string;
    readonly text: string;
    readonly art: ArtName;
    /** An optional next step, such as the contact page. */
    readonly link?: { readonly href: string; readonly label: string };
  }[];
}) {
  return (
    <ul className="m-grid m-grid-2">
      {props.items.map((item) => (
        <li key={item.title} className="card m-card">
          <MarketingArt name={item.art} />
          <h2>{item.title}</h2>
          <p>{item.text}</p>
          {item.link === undefined ? null : (
            <p>
              <a href={item.link.href}>{item.link.label}</a>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
