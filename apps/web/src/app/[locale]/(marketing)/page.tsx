import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { trialDays } from '@thp/domain';
import { createTranslator, isLocale } from '@thp/i18n';
import {
  ClassroomIllustration,
  LessonPlanIllustration,
  ParentPortalIllustration,
} from '../../../components/hero-illustrations.tsx';
import { MarketingArt } from '../../../components/marketing-art.tsx';
import {
  Faq,
  FeatureGrid,
  PlanCards,
  TrialCta,
  UseCaseCards,
} from '../../../components/marketing-sections.tsx';
import { StructuredData } from '../../../components/site-facts.tsx';
import { MarketingShell } from '../../../components/marketing-shell.tsx';
import { marketingMetadata } from '../../../server/marketing-metadata.ts';
import { LanguagePicker } from '../language-picker.tsx';

/** An animated drawing of the workspace: illustrated cards, feature phrases, a finished task. */
function HeroArt({ phrases }: { readonly phrases: readonly string[] }) {
  return (
    <div className="hero-art">
      <span className="hero-sparkle" aria-hidden="true" />
      <div className="hero-window">
        <div className="hero-window-bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="hero-tiles" aria-hidden="true">
          <div className="hero-tile" data-illustration="lesson-plan">
            <LessonPlanIllustration />
          </div>
          <div className="hero-tile" data-illustration="classroom">
            <ClassroomIllustration />
          </div>
          <div className="hero-tile accent" data-illustration="parent-portal">
            <ParentPortalIllustration />
          </div>
        </div>
        <ul className="hero-phrases">
          {phrases.map((phrase) => (
            <li key={phrase} className="hero-phrase">
              {phrase}
            </li>
          ))}
        </ul>
      </div>
      <div className="hero-badge" aria-hidden="true">
        <span className="hero-badge-dot">
          <svg viewBox="0 0 24 24" width="22" height="22" focusable="false">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <span className="hero-badge-line" />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return marketingMetadata(
    locale,
    '',
    'marketing.landing.metaTitle',
    'marketing.landing.metaDescription',
  );
}

const faqNumbers = ['1', '2', '3', '4', '5'] as const;
const trustNumbers = ['1', '2', '3', '4'] as const;
const steps = ['1', '2', '3'] as const;

/** The landing page: the workspace hero, then what the app does, for whom, and how it is priced. */
export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = createTranslator(locale);

  return (
    <MarketingShell locale={locale} path="" languages={false}>
      <StructuredData locale={locale} />
      <section className="hero">
        <div className="hero-copy">
          <h1>{t('home.title')}</h1>
          <p className="tagline">{t('home.tagline')}</p>
          <p className="actions">
            <Link href={`/${locale}/signup`} className="button accent large">
              {t('home.getStarted')}
            </Link>
          </p>
          <LanguagePicker current={locale} label={t('language.label')} />
        </div>
        <HeroArt
          phrases={[t('home.phraseLessons'), t('home.phraseAi'), t('home.phraseWorkflow')]}
        />
      </section>

      <section className="m-section" aria-labelledby="features-heading">
        <h2 id="features-heading">{t('marketing.landing.featuresTitle')}</h2>
        <p className="tagline">{t('marketing.landing.featuresIntro')}</p>
        <FeatureGrid locale={locale} />
      </section>

      <section className="m-section" aria-labelledby="how-heading">
        <h2 id="how-heading">{t('marketing.landing.howTitle')}</h2>
        <ol className="m-grid m-steps">
          {steps.map((n) => (
            <li key={n} className="card m-card">
              <span className="m-step">{n}</span>
              <h3>{t(`marketing.landing.how${n}Title`)}</h3>
              <p>{t(`marketing.landing.how${n}Text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="m-section" aria-labelledby="who-heading">
        <h2 id="who-heading">{t('marketing.landing.whoTitle')}</h2>
        <p className="tagline">{t('marketing.landing.whoIntro')}</p>
        <UseCaseCards locale={locale} />
      </section>

      <section className="m-section" aria-labelledby="trust-heading">
        <h2 id="trust-heading">{t('marketing.landing.trustTitle')}</h2>
        <p className="tagline">{t('marketing.landing.trustIntro')}</p>
        <ul className="m-grid m-grid-2">
          {trustNumbers.map((n) => (
            <li key={n} className="card m-card m-trust">
              <MarketingArt
                name={n === '1' ? 'link' : n === '2' ? 'shield' : n === '3' ? 'lock' : 'check'}
              />
              <p>{t(`marketing.landing.trust${n}`)}</p>
            </li>
          ))}
        </ul>
        <p>
          <Link href={`/${locale}/trust`}>{t('marketing.landing.trustMore')}</Link>
        </p>
      </section>

      <section className="m-section" aria-labelledby="pricing-heading">
        <h2 id="pricing-heading">{t('marketing.landing.pricingTitle')}</h2>
        <p className="tagline">{t('marketing.landing.pricingIntro', { days: trialDays })}</p>
        <PlanCards locale={locale} full={false} />
        <p>
          <Link href={`/${locale}/pricing`}>{t('marketing.landing.pricingSee')}</Link>
        </p>
      </section>

      <Faq
        title={t('marketing.landing.faqTitle')}
        items={faqNumbers.map((n) => ({
          q: t(`marketing.landing.faq${n}Q`),
          a: t(`marketing.landing.faq${n}A`),
        }))}
      />
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
