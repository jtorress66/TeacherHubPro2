import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator, isLocale } from '@thp/i18n';
import { Logo } from '../../components/logo.tsx';
import { LanguagePicker } from './language-picker.tsx';

/** A drawing of the workspace (cards and a chart), for decoration only. */
function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-window">
        <div className="hero-window-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="hero-tiles">
          <div className="hero-tile" />
          <div className="hero-tile" />
          <div className="hero-tile accent" />
        </div>
        <div className="hero-bars">
          <span style={{ width: '82%' }} />
          <span style={{ width: '64%' }} />
          <span style={{ width: '91%' }} />
          <span style={{ width: '48%' }} />
        </div>
      </div>
      <div className="hero-badge">
        <span className="hero-badge-dot" />
        <span className="hero-badge-line" />
      </div>
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = createTranslator(locale);

  return (
    <div className="home">
      <header className="home-header">
        <Link href={`/${locale}`} className="brand">
          <Logo size={36} />
        </Link>
        <Link href={`/${locale}/login`} className="button quiet">
          {t('home.logIn')}
        </Link>
      </header>
      <main className="hero">
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
        <HeroArt />
      </main>
    </div>
  );
}
