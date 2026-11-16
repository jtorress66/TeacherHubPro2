import Link from 'next/link';
import { trialDays } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { onRequest, tools } from '../server/connected-tools.ts';
import { MarketingArt, type ArtName } from './marketing-art.tsx';
import { featureCards, type FeatureKey } from './marketing-sections.tsx';

const check = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** The trial facts under the hero's buttons. */
export function HeroFacts({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <ul className="hero-facts">
      <li>
        {check}
        {t('marketing.home.factTrial', { days: trialDays })}
      </li>
      <li>
        {check}
        {t('marketing.home.factNoCard')}
      </li>
      <li>
        {check}
        {t('marketing.home.factLanguages')}
      </li>
    </ul>
  );
}

/** How much room each feature takes in the grid; the rest take one cell. */
const tileSize: Partial<Record<ArtName, 'big' | 'wide' | 'full'>> = {
  prep_agent: 'big',
  assignments: 'wide',
  ai_assistant: 'wide',
  schools: 'full',
};

/** Prep Agent leads, then the rest in the order that fills the grid without gaps. */
const tileOrder: readonly ArtName[] = [
  'prep_agent',
  'assignments',
  'games',
  'attendance',
  'lesson_planner',
  'gradebook',
  'families',
  'presentations',
  'ai_assistant',
  'learning',
  'command_center',
  'schools',
];

/** The features as a grid of tiles in different sizes, each with a page to read more. */
export function FeatureBento({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const hrefs = new Map(featureCards.map((card) => [card.key, card.href]));
  return (
    <ul className="bento">
      {tileOrder.map((key) => {
        const feature = key as FeatureKey;
        const title = t(`marketing.feature.${feature}.title`);
        const size = tileSize[key];
        return (
          <li key={key} className={size === undefined ? 'bento-tile' : `bento-tile ${size}`}>
            <MarketingArt name={key} />
            <h3>{title}</h3>
            <p>{t(`marketing.feature.${feature}.text`)}</p>
            {key === 'prep_agent' ? (
              <ul className="bento-rows" aria-hidden="true">
                <li>
                  <i />
                  {t('marketing.home.prepRow1')}
                  <span>{t('marketing.home.ready')}</span>
                </li>
                <li>
                  <i className="blue" />
                  {t('marketing.home.prepRow2')}
                  <span>{t('marketing.home.ready')}</span>
                </li>
                <li>
                  <i className="amber" />
                  {t('marketing.home.prepRow3')}
                  <span>{t('marketing.home.waiting')}</span>
                </li>
              </ul>
            ) : null}
            <Link href={`/${locale}${hrefs.get(key) ?? '/features'}`}>
              {t('marketing.featuresPage.learnMore', { feature: title })}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Every connected tool, from the same list as the Integrations page: ready, or on request. */
export function ToolGroups({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const name = (id: (typeof tools)[number]['id']) => t(`connectedTools.tool.${id}.name`);
  const ready = tools.filter((tool) => !onRequest.has(tool.id));
  const asked = tools.filter((tool) => onRequest.has(tool.id));
  return (
    <div className="tool-groups">
      <section className="tool-group" aria-labelledby="tools-ready">
        <h3 id="tools-ready">{t('marketing.home.toolsReady')}</h3>
        <ul>
          {ready.map((tool) => (
            <li key={tool.id}>{name(tool.id)}</li>
          ))}
        </ul>
      </section>
      <section className="tool-group on-request" aria-labelledby="tools-on-request">
        <h3 id="tools-on-request">{t('connectedTools.onRequest')}</h3>
        <p>{t('connectedTools.onRequestText')}</p>
        <ul>
          {asked.map((tool) => (
            <li key={tool.id}>{name(tool.id)}</li>
          ))}
        </ul>
      </section>
      <p className="tool-more">
        <Link href={`/${locale}/integrations`}>{t('marketing.footer.integrations')}</Link>
      </p>
    </div>
  );
}

const pathArt: readonly ArtName[] = ['ai_assistant', 'gradebook', 'check', 'families'];

/** The road every AI draft takes before families see it. */
export function ApprovalPath({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const steps = [
    ['marketing.home.pathStep1', 'marketing.home.pathText1'],
    ['marketing.home.pathStep2', 'marketing.home.pathText2'],
    ['marketing.home.pathStep3', 'marketing.home.pathText3'],
    ['marketing.home.pathStep4', 'marketing.home.pathText4'],
  ] as const;
  return (
    <ol className="approval-path">
      {steps.map(([title, text], i) => (
        <li key={title}>
          <MarketingArt name={pathArt[i] ?? 'check'} />
          <h3>{t(title)}</h3>
          <p>{t(text)}</p>
        </li>
      ))}
    </ol>
  );
}
