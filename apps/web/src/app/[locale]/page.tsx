import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator, isLocale } from '@thp/i18n';
import { Logo } from '../../components/logo.tsx';
import { LanguagePicker } from './language-picker.tsx';

/** An animated drawing of the workspace (cards, feature phrases, a finished task). */
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
          <div className="hero-tile" />
          <div className="hero-tile" />
          <div className="hero-tile accent" />
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
        <HeroArt
          phrases={[t('home.phraseLessons'), t('home.phraseAi'), t('home.phraseWorkflow')]}
        />
      </main>
    </div>
  );
}
