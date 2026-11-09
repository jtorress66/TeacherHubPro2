'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  gradeLevels,
  planWeekdays,
  prepDaysRange,
  standardSubjects,
  type ParentEmail,
  type PrepItem,
} from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  publishPrepAction,
  startPrepAction,
  type PrepFormState,
} from '../app/_lib/prep-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, TextArea, type Option } from './form-fields.tsx';
import { Markdown } from './markdown.tsx';

const initial: PrepFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

/** A class the teacher can prep for, with the form choices it suggests. */
export interface PrepClass {
  readonly id: string;
  readonly name: string;
  readonly subject: string | null;
  readonly grade: string | null;
  readonly categories: readonly Option[];
}

const optionNames = ['presentations', 'worksheets', 'quiz', 'parentEmail'] as const;

/** One prompt, one class, one week: starts the prep agent. */
export function NewPrepForm(props: {
  readonly locale: Locale;
  readonly classes: readonly PrepClass[];
  readonly weekStart: string;
}) {
  const { locale, classes } = props;
  const t = createTranslator(locale);
  const [state, action] = useActionState(startPrepAction, initial);
  const [classId, setClassId] = useState(classes[0]?.id ?? '');
  const cls = classes.find((c) => c.id === classId);
  const errors = state.errors;
  return (
    <form action={action} className="stack" noValidate aria-label={t('prep.newTitle')}>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <div className="field">
        <label htmlFor="prep-class">{t('prep.class')}</label>
        <select
          id="prep-class"
          name="classId"
          value={classId}
          onChange={(event) => {
            setClassId(event.target.value);
          }}
        >
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <TextArea
        id="prep-prompt"
        name="prompt"
        label={t('prep.prompt')}
        hint={t('prep.promptHint')}
        error={errors?.prompt}
        rows={2}
      />
      <div className="field-row" key={classId}>
        <Field
          id="prep-week"
          name="weekStart"
          type="date"
          label={t('prep.weekStart')}
          defaultValue={props.weekStart}
          error={errors?.weekStart}
        />
        <Field
          id="prep-days"
          name="days"
          type="number"
          min={prepDaysRange.min}
          label={t('prep.days')}
          defaultValue={prepDaysRange.default}
          error={errors?.days}
        />
        <Select
          id="prep-subject"
          name="subject"
          label={t('prep.subject')}
          options={standardSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
          defaultValue={cls?.subject ?? 'math'}
          error={errors?.subject}
        />
        <Select
          id="prep-grade"
          name="grade"
          label={t('prep.grade')}
          options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
          defaultValue={cls?.grade ?? '4'}
          error={errors?.grade}
        />
        <Select
          id="prep-language"
          name="language"
          label={t('prep.language')}
          options={locales.map((l) => option(l, localeInfo[l].nativeName))}
          defaultValue={locale}
        />
      </div>
      <fieldset className="checks">
        <legend>{t('prep.options')}</legend>
        {optionNames.map((name) => (
          <label key={name} className="checkbox">
            <input type="checkbox" name="options" value={name} defaultChecked />{' '}
            {t(`prep.option_${name}`)}
          </label>
        ))}
      </fieldset>
      <div key={`category-${classId}`}>
        <Select
          id="prep-category"
          name="quizCategoryId"
          label={t('prep.quizCategory')}
          options={cls?.categories ?? []}
          empty={t('prep.quizCategoryNone')}
          defaultValue={cls?.categories[0]?.id ?? ''}
          error={errors?.quizCategoryId}
        />
      </div>
      <Submit label={t('prep.start')} />
    </form>
  );
}

/** Refreshes the page while the agent works, so progress shows without reloading. */
export function PrepRefresher({ intervalMs = 2000 }: { readonly intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [router, intervalMs]);
  return null;
}

/** An item's name, such as "Slides, Monday". */
export function itemLabel(item: PrepItem, locale: Locale): string {
  const t = createTranslator(locale);
  const weekday = planWeekdays[(item.day ?? 1) - 1] ?? 'Mon';
  const day = t(`planner.day_${weekday}`);
  switch (item.kind) {
    case 'presentation':
      return t('prep.item_presentation', { day });
    case 'worksheet':
      return t('prep.item_worksheet', { day });
    default:
      return t(`prep.item_${item.kind}`);
  }
}

function PlanPreview({ item, locale }: { readonly item: PrepItem; readonly locale: Locale }) {
  const t = createTranslator(locale);
  if (item.kind !== 'plan' || item.content === null) return null;
  const plan = item.content;
  return (
    <div className="stack">
      {plan.unit === null ? null : (
        <p>
          <strong>{t('prep.unit')}:</strong> {plan.unit}
        </p>
      )}
      <p>
        <strong>{t('prep.objective')}:</strong>
      </p>
      <Markdown source={plan.objective} />
      {plan.standards.length === 0 ? null : (
        <p>
          <strong>{t('prep.standards')}:</strong> {plan.standards.join(', ')}
        </p>
      )}
      <ol className="list">
        {plan.days.map((day, index) => (
          <li key={planWeekdays[index]}>
            <strong>{t(`planner.day_${planWeekdays[index] ?? 'Mon'}`)}:</strong>{' '}
            {day.theme ?? t('prep.noTheme')}
            <div className="hint">
              <Markdown source={day.notes} />
              {(day.activities ?? []).map((activity, a) => (
                <Markdown key={a} source={activity.notes} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SlidesPreview({ item }: { readonly item: PrepItem }) {
  if (item.kind !== 'presentation' || item.content === null) return null;
  return (
    <div className="stack">
      <h4>{item.content.title}</h4>
      <ol className="list">
        {item.content.slides.map((slide, index) => (
          <li key={index}>
            <strong>{slide.title}</strong>
            {slide.content ? <p>{slide.content}</p> : null}
            {slide.bullets === undefined || slide.bullets.length === 0 ? null : (
              <ul>
                {slide.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuizPreview({ item, locale }: { readonly item: PrepItem; readonly locale: Locale }) {
  const t = createTranslator(locale);
  if (item.kind !== 'quiz' || item.content === null) return null;
  const answerOf = (question: (typeof item.content.questions)[number]): string | null => {
    switch (question.type) {
      case 'multiple_choice':
        return question.options[question.correctOption] ?? null;
      case 'true_false':
        return question.answer ? t('prep.true') : t('prep.false');
      case 'fill_blank':
        return question.acceptedAnswers.join(', ');
      case 'short_answer':
        return question.modelAnswer;
      default:
        return null;
    }
  };
  return (
    <div className="stack">
      {item.content.instructions === null ? null : <p>{item.content.instructions}</p>}
      <ol className="list">
        {item.content.questions.map((question) => {
          const answer = answerOf(question);
          return (
            <li key={question.id}>
              {question.prompt}
              {question.type === 'multiple_choice' ? (
                <ul>
                  {question.options.map((choice) => (
                    <li key={choice}>{choice}</li>
                  ))}
                </ul>
              ) : null}
              {answer === null ? null : <p className="hint">{t('prep.answer', { answer })}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ItemPreview({ item, locale }: { readonly item: PrepItem; readonly locale: Locale }) {
  if (item.kind === 'worksheet') return <Markdown source={item.content} />;
  if (item.kind === 'presentation') return <SlidesPreview item={item} />;
  if (item.kind === 'quiz') return <QuizPreview item={item} locale={locale} />;
  return <PlanPreview item={item} locale={locale} />;
}

/**
 * The teacher's review: tick the drafts to keep, preview each one beside the list, edit the
 * parent email, then approve and publish.
 */
export function PrepReview(props: {
  readonly locale: Locale;
  readonly batchId: string;
  readonly items: readonly PrepItem[];
  readonly parentEmail: ParentEmail | null;
  readonly recipients: number;
}) {
  const { locale, items } = props;
  const t = createTranslator(locale);
  const [state, action] = useActionState(publishPrepAction, initial);
  const [shown, setShown] = useState(items.find((i) => i.status === 'done')?.key ?? '');
  const current = items.find((i) => i.key === shown);
  const errors = state.errors ?? {};
  const general = Object.entries(errors).find(
    ([field]) => field !== 'emailSubject' && field !== 'emailBody',
  )?.[1];
  return (
    <form action={action} className="stack" aria-label={t('prep.review')}>
      <Hidden values={{ locale, batchId: props.batchId }} />
      <FormAlert message={general} />
      <div className="prep-review">
        <fieldset className="card stack prep-items">
          <legend>{t('prep.drafts')}</legend>
          <ul className="list">
            {items.map((item) => {
              const label = itemLabel(item, locale);
              return (
                <li key={item.key} aria-current={item.key === shown ? 'true' : undefined}>
                  {item.status === 'done' ? (
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        name="keep"
                        value={item.key}
                        defaultChecked={item.include}
                        aria-label={t('prep.keep', { item: label })}
                      />{' '}
                      {label}
                    </label>
                  ) : (
                    <span className="muted">
                      {label}: {t('prep.itemFailed')}
                    </span>
                  )}{' '}
                  {item.status === 'done' ? (
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`${t('prep.show')}: ${label}`}
                      onClick={() => {
                        setShown(item.key);
                      }}
                    >
                      {t('prep.show')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>
        <section className="card stack prep-preview" aria-labelledby="prep-preview-heading">
          <h3 id="prep-preview-heading">
            {t('prep.preview')}
            {current === undefined ? '' : `: ${itemLabel(current, locale)}`}
          </h3>
          {current === undefined ? null : <ItemPreview item={current} locale={locale} />}
        </section>
      </div>
      {props.parentEmail === null ? null : (
        <section className="card stack" aria-labelledby="prep-email-heading">
          <h3 id="prep-email-heading">{t('prep.email')}</h3>
          <p className="hint">
            {props.recipients === 0
              ? t('prep.noRecipients')
              : t('prep.recipients', { count: props.recipients })}
          </p>
          <Field
            id="prep-email-subject"
            name="emailSubject"
            label={t('prep.emailSubjectLabel')}
            defaultValue={props.parentEmail.subject}
            error={errors.emailSubject}
          />
          <TextArea
            id="prep-email-body"
            name="emailBody"
            label={t('prep.emailBodyLabel')}
            defaultValue={props.parentEmail.body}
            error={errors.emailBody}
            rows={10}
          />
        </section>
      )}
      <Submit label={t('prep.publish')} />
    </form>
  );
}
