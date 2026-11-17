'use client';

import { useActionState, useState } from 'react';
import {
  assistantSubjects,
  gradeLevels,
  rubricCriteriaRange,
  rubricLevelRange,
  type Rubric,
  type RubricCriterion,
  type RubricLevel,
} from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  createRubricAction,
  deleteRubricAction,
  requestRubricDraftAction,
  saveRubricAction,
  type RubricFormState,
} from '../app/_lib/rubric-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { EslSwitch, Hidden, Select, TextArea, type Option } from './form-fields.tsx';
import { prefill, type Prefill } from '../server/form-values.ts';
import { RubricGrid } from './rubric-grid.tsx';

const initial: RubricFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

function SubjectAndGrade(props: {
  readonly locale: Locale;
  readonly errors: RubricFormState['errors'];
  readonly subject?: string | null;
  readonly grade?: string | null;
  readonly sent: Prefill;
}) {
  const t = createTranslator(props.locale);
  return (
    <>
      <Select
        id="subject"
        name="subject"
        label={t('rubrics.subject')}
        empty={t('rubrics.any')}
        options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
        defaultValue={props.sent.text('subject', props.subject ?? '')}
        error={props.errors?.subject}
      />
      <Select
        id="grade"
        name="grade"
        label={t('rubrics.grade')}
        empty={t('rubrics.any')}
        options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
        defaultValue={props.sent.text('grade', props.grade ?? '')}
        error={props.errors?.grade}
      />
    </>
  );
}

function Counts({
  locale,
  prefix,
  errors,
  sent,
}: {
  readonly locale: Locale;
  readonly prefix: string;
  readonly errors: RubricFormState['errors'];
  readonly sent: Prefill;
}) {
  const t = createTranslator(locale);
  return (
    <div className="field-row">
      <Field
        id={`${prefix}-criteriaCount`}
        name="criteriaCount"
        type="number"
        min={rubricCriteriaRange.min}
        max={rubricCriteriaRange.max}
        label={t('rubrics.criteria')}
        defaultValue={sent.text('criteriaCount', rubricCriteriaRange.default)}
        error={errors?.criteriaCount ?? errors?.criteria}
      />
      <Field
        id={`${prefix}-levelCount`}
        name="levelCount"
        type="number"
        min={rubricLevelRange.min}
        max={rubricLevelRange.max}
        label={t('rubrics.levels')}
        defaultValue={sent.text('levelCount', rubricLevelRange.default)}
        error={errors?.levelCount ?? errors?.levels}
      />
    </div>
  );
}

/** What the teacher asks the AI to draft a rubric for. */
export function RubricDraftForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(requestRubricDraftAction, initial);
  const errors = state.errors;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack card"
      noValidate
      aria-label={t('rubrics.aiDraft')}
      key={sent.key}
    >
      <h2>{t('rubrics.aiDraft')}</h2>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field
        id="topic"
        name="topic"
        label={t('rubrics.topic')}
        defaultValue={sent.text('topic')}
        error={errors?.topic}
        required
      />
      <div className="field-row">
        <SubjectAndGrade locale={locale} errors={errors} sent={sent} />
      </div>
      <div className="field-row">
        <Field
          id="draft-title"
          name="title"
          label={t('rubrics.titleOptional')}
          defaultValue={sent.text('title')}
          error={errors?.title}
        />
        <Select
          id="language"
          name="language"
          label={t('assistant.language')}
          options={locales.map((l) => option(l, localeInfo[l].nativeName))}
          defaultValue={sent.text('language', locale)}
        />
      </div>
      <EslSwitch
        label={t('esl.label')}
        help={t('esl.rubricHelp')}
        defaultChecked={sent.checked('esl')}
      />
      <Counts locale={locale} prefix="draft" errors={errors} sent={sent} />
      <TextArea
        id="instructions"
        name="instructions"
        label={t('assistant.instructions')}
        defaultValue={sent.text('instructions')}
        error={errors?.instructions}
      />
      <Submit label={t('rubrics.generate')} />
    </form>
  );
}

/** Starts an empty grid the teacher fills in. */
export function BlankRubricForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(createRubricAction, initial);
  const errors = state.errors;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack card"
      noValidate
      aria-label={t('rubrics.startBlank')}
      key={sent.key}
    >
      <h2>{t('rubrics.startBlank')}</h2>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field
        id="blank-title"
        name="title"
        label={t('rubrics.title')}
        defaultValue={sent.text('title')}
        error={errors?.title}
        required
      />
      <Counts locale={locale} prefix="blank" errors={errors} sent={sent} />
      <Submit label={t('rubrics.create')} />
    </form>
  );
}

/** Keeps a finished AI draft as a new rubric. */
export function KeepRubricDraftForm(props: { readonly locale: Locale; readonly jobId: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(createRubricAction, initial);
  return (
    <form action={action} className="stack">
      <Hidden values={{ locale: props.locale, jobId: props.jobId }} />
      <FormAlert
        message={state.errors === undefined ? undefined : Object.values(state.errors).join(' ')}
      />
      <Submit label={t('rubrics.keep')} />
    </form>
  );
}

/** The grid: level names and points across the top, one row per criterion. */
export function RubricEditor(props: { readonly locale: Locale; readonly rubric: Rubric }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveRubricAction, initial);
  const sent = prefill(state.values);
  const [levels, setLevels] = useState<RubricLevel[]>([...props.rubric.levels]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([...props.rubric.criteria]);
  const errors = state.errors;

  return (
    <form action={action} className="stack" noValidate aria-label={t('rubrics.editor')}>
      <Hidden
        values={{
          locale: props.locale,
          rubricId: props.rubric.id,
          grid: JSON.stringify({ levels, criteria }),
        }}
      />
      <FormAlert message={errors === undefined ? undefined : Object.values(errors).join(' ')} />
      {state.saved ? (
        <p role="status" className="notice" key={state.version}>
          {t('rubrics.saved')}
        </p>
      ) : null}
      {/* Keyed alone, so a refused save shows the title and choices sent; the grid keeps its state. */}
      <div className="field-row" key={sent.key}>
        <Field
          id="title"
          name="title"
          label={t('rubrics.title')}
          defaultValue={sent.text('title', props.rubric.title)}
          required
        />
        <SubjectAndGrade
          locale={props.locale}
          errors={errors}
          subject={props.rubric.subject}
          grade={props.rubric.grade}
          sent={sent}
        />
      </div>
      <RubricGrid
        locale={props.locale}
        levels={levels}
        criteria={criteria}
        onLevels={setLevels}
        onCriteria={setCriteria}
      />
      <Submit label={t('rubrics.save')} />
    </form>
  );
}

export function DeleteRubricForm(props: { readonly locale: Locale; readonly rubricId: string }) {
  const t = createTranslator(props.locale);
  return (
    <form action={deleteRubricAction}>
      <Hidden values={{ locale: props.locale, rubricId: props.rubricId }} />
      <button type="submit" className="button secondary">
        {t('rubrics.delete')}
      </button>
    </form>
  );
}
