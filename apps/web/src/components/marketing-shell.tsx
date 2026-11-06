import Link from 'next/link';
import type { ReactNode } from 'react';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import { featureSlugs, legalPages, legalSlugs, useCaseSlugs } from '../server/marketing-pages.ts';
import { ChatbotWidget } from './chatbot-widget.tsx';
import { Logo } from './logo.tsx';

/** The public site's header, footer and chat around a page. */
export function MarketingShell(props: {
  readonly locale: Locale;
  /** The page's path after the language, so the language links keep the visitor on it. */
  readonly path: string;
  /** False on the home page, whose hero has its own language links. */
  readonly languages?: boolean;
  readonly children: ReactNode;
}) {
  const { locale } = props;
  const t = createTranslator(locale);
  const base = `/${locale}`;
  return (
    <div className="home marketing">
      <header className="home-header m-header">
        <Link href={base} className="brand">
          <Logo size={36} />
        </Link>
        <nav aria-label={t('marketing.nav.label')} className="m-nav">
          <Link href={`${base}/features`}>{t('marketing.nav.features')}</Link>
          <Link href={`${base}/use-cases`}>{t('marketing.nav.useCases')}</Link>
          <Link href={`${base}/pricing`}>{t('marketing.nav.pricing')}</Link>
          <Link href={`${base}/contact`}>{t('marketing.nav.contact')}</Link>
        </nav>
        <p className="m-header-actions">
          <Link href={`${base}/login`} className="button quiet">
            {t('marketing.nav.logIn')}
          </Link>
          <Link href={`${base}/signup`} className="button accent">
            {t('marketing.nav.startTrial')}
          </Link>
        </p>
      </header>
      <main>{props.children}</main>
      <footer className="m-footer">
        <div className="m-footer-brand">
          <Logo size={28} />
          <p className="muted">{t('marketing.footer.tagline')}</p>
          {props.languages === false ? null : (
            <nav aria-label={t('language.label')} className="language-picker">
              <ul>
                {locales.map((l) => (
                  <li key={l}>
                    <a
                      href={`/${l}${props.path}`}
                      hrefLang={l}
                      lang={l}
                      aria-current={l === locale ? 'page' : undefined}
                    >
                      {localeInfo[l].nativeName}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <nav aria-labelledby="footer-product" className="m-footer-col">
          <h2 id="footer-product">{t('marketing.footer.product')}</h2>
          <ul>
            {featureSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`${base}/features/${slug}`}>
                  {t(`marketing.features.${slug}.title`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href={`${base}/ai`}>{t('marketing.footer.ai')}</Link>
            </li>
            <li>
              <Link href={`${base}/pricing`}>{t('marketing.nav.pricing')}</Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-use-cases" className="m-footer-col">
          <h2 id="footer-use-cases">{t('marketing.footer.useCases')}</h2>
          <ul>
            {useCaseSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`${base}/use-cases/${slug}`}>
                  {t(`marketing.useCases.${slug}.title`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-company" className="m-footer-col">
          <h2 id="footer-company">{t('marketing.footer.company')}</h2>
          <ul>
            <li>
              <Link href={`${base}/enterprise`}>{t('marketing.footer.enterprise')}</Link>
            </li>
            <li>
              <Link href={`${base}/integrations`}>{t('marketing.footer.integrations')}</Link>
            </li>
            <li>
              <Link href={`${base}/help`}>{t('marketing.footer.help')}</Link>
            </li>
            <li>
              <Link href={`${base}/contact`}>{t('marketing.nav.contact')}</Link>
            </li>
          </ul>
        </nav>
        <nav aria-labelledby="footer-legal" className="m-footer-col">
          <h2 id="footer-legal">{t('marketing.footer.legal')}</h2>
          <ul>
            {legalSlugs.map((slug) => (
              <li key={slug}>
                <Link href={`${base}/${slug}`}>{t(`legal.${legalPages[slug]}.title`)}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="m-footer-rights muted">
          {t('marketing.footer.rights', { year: new Date().getFullYear() })}
        </p>
      </footer>
      <ChatbotWidget locale={locale} path={props.path} />
    </div>
  );
}
