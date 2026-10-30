'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PresentationTheme, Slide } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { slideSpeech } from '../server/slide-view.ts';
import { ListenButton } from './listen-button.tsx';
import { SlideView } from './slide-view.tsx';

/** Shows one slide at a time over the whole window; arrow keys move, Escape leaves. */
export function Presenter(props: {
  readonly locale: Locale;
  readonly language: string;
  readonly slides: readonly Slide[];
  readonly theme: PresentationTheme;
  readonly exitHref: string;
}) {
  const t = createTranslator(props.locale);
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const total = props.slides.length;
  const { exitHref } = props;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        setIndex((current) => Math.min(current + 1, total - 1));
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        setIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === 'Escape') {
        router.push(exitHref);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [total, router, exitHref]);

  const slide = props.slides[index];
  if (slide === undefined) return null;
  return (
    <div className="presenter" role="region" aria-label={t('presentations.present')}>
      <SlideView key={index} slide={slide} theme={props.theme} animate />
      <div className="presenter-controls">
        <button
          type="button"
          className="button secondary"
          disabled={index === 0}
          onClick={() => {
            setIndex(index - 1);
          }}
        >
          {t('presentations.previous')}
        </button>
        <span aria-live="polite">{t('presentations.position', { number: index + 1, total })}</span>
        <button
          type="button"
          className="button secondary"
          disabled={index === total - 1}
          onClick={() => {
            setIndex(index + 1);
          }}
        >
          {t('presentations.next')}
        </button>
        <ListenButton locale={props.locale} language={props.language} text={slideSpeech(slide)} />
        <a className="button secondary" href={exitHref}>
          {t('presentations.exit')}
        </a>
        <span className="hint">{t('presentations.keysHint')}</span>
      </div>
    </div>
  );
}
