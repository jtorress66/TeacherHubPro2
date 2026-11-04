'use client';

import { useState, useTransition } from 'react';
import type { LearningLesson, LessonCheck } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { savePathAction, type LearningFormState } from '../../app/_lib/learning-actions.ts';
import { ListenButton } from '../listen-button.tsx';

interface Draft {
  readonly title: string;
  readonly description: string;
  readonly lessons: readonly LearningLesson[];
}

const lines = (text: string): string[] => text.split('\n').map((line) => line.trim());

/** One check: its question, its options one per line, and which option is right. */
function CheckFields(props: {
  readonly locale: Locale;
  readonly id: string;
  readonly n: number;
  readonly check: LessonCheck;
  readonly change: (check: LessonCheck) => void;
}) {
  const t = createTranslator(props.locale);
  const { check, id } = props;
  return (
    <fieldset className="stack check-fields">
      <legend>{t('learning.check', { n: props.n })}</legend>
      <div className="field">
        <label htmlFor={`${id}-prompt`}>{t('learning.prompt')}</label>
        <input
          id={`${id}-prompt`}
          value={check.prompt}
          onChange={(e) => {
            props.change({ ...check, prompt: e.target.value });
          }}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-options`}>{t('learning.options')}</label>
          <textarea
            id={`${id}-options`}
            rows={Math.max(2, check.options.length)}
            value={check.options.join('\n')}
            onChange={(e) => {
              props.change({ ...check, options: lines(e.target.value) });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-answer`}>{t('learning.rightAnswer')}</label>
          <select
            id={`${id}-answer`}
            value={check.answer}
            onChange={(e) => {
              props.change({ ...check, answer: Number(e.target.value) });
            }}
          >
            {check.options.map((option, i) => (
              <option key={i} value={i}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

function LessonFields(props: {
  readonly locale: Locale;
  readonly language: string;
  readonly index: number;
  readonly lesson: LearningLesson;
  readonly change: (lesson: LearningLesson) => void;
}) {
  const t = createTranslator(props.locale);
  const { lesson, index } = props;
  const id = `lesson-${String(index)}`;
  const set = (patch: Partial<LearningLesson>) => {
    props.change({ ...lesson, ...patch });
  };
  return (
    <fieldset className="card stack">
      <legend>{t('learning.lesson', { n: index + 1 })}</legend>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-title`}>{t('learning.lessonTitle')}</label>
          <input
            id={`${id}-title`}
            value={lesson.title}
            onChange={(e) => {
              set({ title: e.target.value });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-minutes`}>{t('learning.minutes')}</label>
          <input
            id={`${id}-minutes`}
            type="number"
            value={lesson.minutes}
            onChange={(e) => {
              set({ minutes: Number(e.target.value) });
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${id}-objective`}>{t('learning.objective')}</label>
        <input
          id={`${id}-objective`}
          value={lesson.objective}
          onChange={(e) => {
            set({ objective: e.target.value });
          }}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-content`}>{t('learning.content')}</label>
        <textarea
          id={`${id}-content`}
          rows={6}
          value={lesson.content}
          onChange={(e) => {
            set({ content: e.target.value });
          }}
        />
      </div>
      <ListenButton locale={props.locale} language={props.language} text={lesson.content} />
      {lesson.checks.map((check, c) => (
        <CheckFields
          key={c}
          locale={props.locale}
          id={`${id}-check-${String(c)}`}
          n={c + 1}
          check={check}
          change={(next) => {
            set({ checks: lesson.checks.map((old, i) => (i === c ? next : old)) });
          }}
        />
      ))}
    </fieldset>
  );
}

/** The teacher reviews a drafted path and fixes anything before assigning it. */
export function PathEditor(props: {
  readonly locale: Locale;
  readonly pathId: string;
  readonly language: string;
  readonly initial: Draft;
}) {
  const t = createTranslator(props.locale);
  const [draft, setDraft] = useState<Draft>(props.initial);
  const [state, setState] = useState<LearningFormState>({});
  const [pending, startTransition] = useTransition();
  const error = state.errors === undefined ? undefined : Object.values(state.errors)[0];

  const save = () => {
    startTransition(async () => {
      setState(await savePathAction(props.locale, props.pathId, draft));
    });
  };

  return (
    <form
      className="stack"
      aria-label={t('learning.edit')}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {error === undefined ? null : (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {state.saved === true && !pending ? (
        <p role="status" className="notice">
          {t('learning.saved')}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="path-title">{t('learning.pathTitle')}</label>
        <input
          id="path-title"
          value={draft.title}
          onChange={(e) => {
            setDraft({ ...draft, title: e.target.value });
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="path-description">{t('learning.description')}</label>
        <input
          id="path-description"
          value={draft.description}
          onChange={(e) => {
            setDraft({ ...draft, description: e.target.value });
          }}
        />
      </div>
      {draft.lessons.map((lesson, index) => (
        <LessonFields
          key={index}
          locale={props.locale}
          language={props.language}
          index={index}
          lesson={lesson}
          change={(next) => {
            setDraft({
              ...draft,
              lessons: draft.lessons.map((old, i) => (i === index ? next : old)),
            });
          }}
        />
      ))}
      <div className="button-row">
        <button type="submit" className="button" disabled={pending}>
          {t('learning.save')}
        </button>
      </div>
    </form>
  );
}
