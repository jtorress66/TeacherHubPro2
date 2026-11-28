import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { TrialCta } from '../../../../components/marketing-sections.tsx';
import { MarketingShell } from '../../../../components/marketing-shell.tsx';
import { tourChapters, tourImage, tourScreens, tourSteps } from '../../../../server/demo-tour.ts';
import { marketingMetadata } from '../../../../server/marketing-metadata.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return marketingMetadata(
    await localeFrom(props),
    '/demo',
    'demo.metaTitle',
    'demo.metaDescription',
  );
}

/** The product tour: every part of the app, step by step, with a screenshot of each. */
export default async function DemoPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  return (
    <MarketingShell locale={locale} path="/demo">
      <section className="m-section m-intro">
        <h1>{t('demo.title')}</h1>
        <p className="tagline">{t('demo.intro', { steps: tourSteps.length })}</p>
        <p>
          <Link href={`/${locale}/signup`} className="button accent large">
            {t('marketing.nav.startTrial')}
          </Link>
        </p>
      </section>
      <div className="demo-tour">
        <nav aria-labelledby="demo-tour-contents" className="demo-tour-contents card">
          <h2 id="demo-tour-contents">{t('demo.contents')}</h2>
          <ol>
            {tourChapters.map((chapter) => (
              <li key={chapter.id}>
                <a href={`#${chapter.id}`}>{t(`demo.chapters.${chapter.id}.title`)}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="demo-tour-chapters">
          {tourChapters.map((chapter, index) => (
            <section key={chapter.id} id={chapter.id} aria-labelledby={`${chapter.id}-heading`}>
              <p className="demo-tour-kicker">{t('demo.chapterNumber', { n: index + 1 })}</p>
              <h2 id={`${chapter.id}-heading`}>{t(`demo.chapters.${chapter.id}.title`)}</h2>
              <p className="tagline">{t(`demo.chapters.${chapter.id}.intro`)}</p>
              <ol className="demo-tour-steps">
                {tourSteps
                  .filter((step) => step.chapter === chapter.id)
                  .map((step) => {
                    const src = tourImage(locale, step.id);
                    const screen = tourScreens[step.device];
                    return (
                      <li
                        key={step.id}
                        className={`demo-tour-step demo-tour-step-${step.device}`}
                        id={`step-${step.id}`}
                      >
                        <h3>
                          <span className="demo-tour-number" aria-hidden="true">
                            {step.number}
                          </span>
                          {t(`demo.steps.${step.id}.title`)}
                        </h3>
                        <p>{t(`demo.steps.${step.id}.text`)}</p>
                        <a
                          href={src}
                          className="demo-tour-shot"
                          aria-label={t('demo.enlarge', {
                            title: t(`demo.steps.${step.id}.title`),
                          })}
                        >
                          <img
                            src={src}
                            alt={t(`demo.steps.${step.id}.alt`)}
                            width={screen.width}
                            height={screen.height}
                            loading="lazy"
                            decoding="async"
                          />
                        </a>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </div>
      </div>
      <p className="hint demo-tour-note">{t('demo.madeUp')}</p>
      <TrialCta locale={locale} />
    </MarketingShell>
  );
}
