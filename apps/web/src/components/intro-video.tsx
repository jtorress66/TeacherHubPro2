import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import { introParagraphs } from '../server/video-captions.ts';

/**
 * The narrated tour of the app. It never plays by itself and loads nothing until played; captions
 * come in every language (the page's own is on by default), and the full script sits below it.
 */
export function IntroVideo({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <section className="m-section" aria-labelledby="video-heading">
      <h2 id="video-heading">{t('marketing.video.title')}</h2>
      <div className="m-video">
        <video
          controls
          preload="none"
          playsInline
          poster="/video/teacherhubpro-intro-poster.jpg"
          width={1920}
          height={1080}
          aria-labelledby="video-heading"
          aria-describedby="video-note"
        >
          <source src="/video/teacherhubpro-intro.mp4" type="video/mp4" />
          {locales.map((language) => (
            <track
              key={language}
              kind="captions"
              src={`/api/video-captions/${language}.vtt`}
              srcLang={language}
              label={localeInfo[language].nativeName}
              default={language === locale}
            />
          ))}
        </video>
      </div>
      <p id="video-note" className="hint">
        {t('marketing.video.note')}
      </p>
      <details className="m-video-script">
        <summary>{t('marketing.video.scriptTitle')}</summary>
        {introParagraphs.map((n) => (
          <p key={n}>{t(`marketing.video.p${n}`)}</p>
        ))}
      </details>
    </section>
  );
}
