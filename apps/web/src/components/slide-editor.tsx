'use client';

import { useActionState, useState } from 'react';
import {
  blankSlide,
  duplicateSlide,
  maxSlides,
  moveSlide,
  presentationThemes,
  removeSlide,
  slideLayouts,
  slideTransitions,
  type Presentation,
  type PresentationTheme,
  type Slide,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { savePresentationAction, type AssistantFormState } from '../app/_lib/assistant-actions.ts';
import { bulletLines, bulletsText, slideSpeech } from '../server/slide-view.ts';
import { FormAlert, Submit } from './forms.tsx';
import { Hidden } from './form-fields.tsx';
import { ListenButton } from './listen-button.tsx';
import { SlideView } from './slide-view.tsx';

const initial: AssistantFormState = {};
const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value);

/** Edits a whole presentation in the browser and saves every slide at once. */
export function SlideEditor(props: {
  readonly locale: Locale;
  readonly presentation: Presentation;
  readonly language: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(savePresentationAction, initial);
  const [name, setName] = useState(props.presentation.name);
  const [theme, setTheme] = useState<PresentationTheme>(props.presentation.theme);
  const [slides, setSlides] = useState<readonly Slide[]>(props.presentation.slides);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, slides.length - 1);
  const slide = slides[index] ?? blankSlide('content');

  const change = (patch: Partial<Slide>) => {
    setSlides(slides.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };
  const move = (to: number) => {
    setSlides(moveSlide(slides, index, to));
    if (to >= 0 && to < slides.length) setSelected(to);
  };
  const errors = state.errors;
  const fieldId = (field: string) => `slide-${field}`;

  return (
    <form action={action} className="slide-editor stack" aria-label={t('presentations.edit')}>
      <Hidden
        values={{
          locale: props.locale,
          presentationId: props.presentation.id,
          slides: JSON.stringify(slides),
        }}
      />
      <FormAlert message={errors === undefined ? undefined : Object.values(errors).join(' ')} />
      {state.saved ? (
        <p role="status" className="notice">
          {t('presentations.saved')}
        </p>
      ) : null}
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">{t('presentations.name')}</label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="theme">{t('presentations.theme')}</label>
          <select
            id="theme"
            name="theme"
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value as PresentationTheme);
            }}
          >
            {presentationThemes.map((value) => (
              <option key={value} value={value}>
                {t(`presentations.theme_${value}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="slide-workspace">
        <ol className="slide-list" aria-label={t('presentations.title')}>
          {slides.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={i === index ? 'slide-thumb current' : 'slide-thumb'}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => {
                  setSelected(i);
                }}
              >
                {s.emoji} {s.title === '' ? t('presentations.slide', { number: i + 1 }) : s.title}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="button secondary"
              disabled={slides.length >= maxSlides}
              onClick={() => {
                setSlides([...slides, blankSlide('content')]);
                setSelected(slides.length);
              }}
            >
              {t('presentations.addSlide')}
            </button>
          </li>
        </ol>

        <fieldset className="slide-fields stack">
          <legend>{t('presentations.slide', { number: index + 1 })}</legend>
          <div className="button-row">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                move(index - 1);
              }}
            >
              {t('presentations.moveUp')}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                move(index + 1);
              }}
            >
              {t('presentations.moveDown')}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setSlides(duplicateSlide(slides, index));
              }}
            >
              {t('presentations.duplicate')}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={slides.length === 1}
              onClick={() => {
                setSlides(removeSlide(slides, index));
                setSelected(Math.max(0, index - 1));
              }}
            >
              {t('presentations.removeSlide')}
            </button>
            <ListenButton
              locale={props.locale}
              language={props.language}
              text={slideSpeech(slide)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor={fieldId('layout')}>{t('presentations.layout')}</label>
              <select
                id={fieldId('layout')}
                value={slide.layout}
                onChange={(event) => {
                  change({ layout: event.target.value as Slide['layout'] });
                }}
              >
                {slideLayouts.map((value) => (
                  <option key={value} value={value}>
                    {t(`presentations.layout_${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={fieldId('emoji')}>{t('presentations.emoji')}</label>
              <input
                id={fieldId('emoji')}
                value={slide.emoji}
                onChange={(event) => {
                  change({ emoji: event.target.value.trim() });
                }}
              />
            </div>
            <div className="field">
              <label htmlFor={fieldId('transition')}>{t('presentations.transition')}</label>
              <select
                id={fieldId('transition')}
                value={slide.transition}
                onChange={(event) => {
                  change({ transition: event.target.value as Slide['transition'] });
                }}
              >
                {slideTransitions.map((value) => (
                  <option key={value} value={value}>
                    {t(`presentations.transition_${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor={fieldId('title')}>{t('presentations.slideTitle')}</label>
            <input
              id={fieldId('title')}
              value={slide.title}
              onChange={(event) => {
                change({ title: event.target.value });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('subtitle')}>{t('presentations.subtitle')}</label>
            <input
              id={fieldId('subtitle')}
              value={slide.subtitle ?? ''}
              onChange={(event) => {
                change({ subtitle: blankToNull(event.target.value) });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('content')}>{t('presentations.content')}</label>
            <textarea
              id={fieldId('content')}
              rows={3}
              value={slide.content ?? ''}
              onChange={(event) => {
                change({ content: blankToNull(event.target.value) });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={fieldId('bullets')}>{t('presentations.bullets')}</label>
            <textarea
              id={fieldId('bullets')}
              rows={4}
              defaultValue={bulletsText(slide.bullets)}
              key={`bullets-${String(index)}`}
              onChange={(event) => {
                change({ bullets: bulletLines(event.target.value) });
              }}
            />
          </div>
        </fieldset>

        <div className="slide-preview" aria-label={t('presentations.preview')}>
          <SlideView slide={slide} theme={theme} />
        </div>
      </div>
      <Submit label={t('presentations.save')} />
    </form>
  );
}
