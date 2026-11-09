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

const initial: RubricFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

function SubjectAndGrade(props: {
  readonly locale: Locale;
  readonly errors: RubricFormState['errors'];
  readonly subject?: string | null;
  readonly grade?: string | null;
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
        defaultValue={props.subject ?? ''}
        error={props.errors?.subject}
      />
      <Select
        id="grade"
        name="grade"
        label={t('rubrics.grade')}
        empty={t('rubrics.any')}
        options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
        defaultValue={props.grade ?? ''}
        error={props.errors?.grade}
      />
    </>
  );
}

function Counts({
  locale,
  prefix,
  errors,
}: {
  readonly locale: Locale;
  readonly prefix: string;
  readonly errors: RubricFormState['errors'];
}) {
  const t = createTranslator(locale);
  return (
    <div className="field-row">
      <Field
        id={`${prefix}-criteriaCount`}
        name="criteriaCount"
        type="number"
        min={rubricCriteriaRange.min}
        label={t('rubrics.criteria')}
        defaultValue={rubricCriteriaRange.default}
        error={errors?.criteriaCount ?? errors?.criteria}
      />
      <Field
        id={`${prefix}-levelCount`}
        name="levelCount"
        type="number"
        min={rubricLevelRange.min}
        label={t('rubrics.levels')}
        defaultValue={rubricLevelRange.default}
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
  return (
    <form action={action} className="stack card" noValidate aria-label={t('rubrics.aiDraft')}>
      <h2>{t('rubrics.aiDraft')}</h2>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field id="topic" name="topic" label={t('rubrics.topic')} error={errors?.topic} required />
      <div className="field-row">
        <SubjectAndGrade locale={locale} errors={errors} />
      </div>
      <div className="field-row">
        <Field
          id="draft-title"
          name="title"
          label={t('rubrics.titleOptional')}
          error={errors?.title}
        />
        <Select
          id="language"
          name="language"
          label={t('assistant.language')}
          options={locales.map((l) => option(l, localeInfo[l].nativeName))}
          defaultValue={locale}
        />
      </div>
      <EslSwitch label={t('esl.label')} help={t('esl.rubricHelp')} />
      <Counts locale={locale} prefix="draft" errors={errors} />
      <TextArea
        id="instructions"
        name="instructions"
        label={t('assistant.instructions')}
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
  return (
    <form action={action} className="stack card" noValidate aria-label={t('rubrics.startBlank')}>
      <h2>{t('rubrics.startBlank')}</h2>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field
        id="blank-title"
        name="title"
        label={t('rubrics.title')}
        error={errors?.title}
        required
      />
      <Counts locale={locale} prefix="blank" errors={errors} />
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

const resize = (list: readonly string[], length: number) =>
  Array.from({ length }, (_, index) => list[index] ?? '');

/** The grid: level names and points across the top, one row per criterion. */
export function RubricEditor(props: { readonly locale: Locale; readonly rubric: Rubric }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveRubricAction, initial);
  const [levels, setLevels] = useState<RubricLevel[]>([...props.rubric.levels]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([...props.rubric.criteria]);
  const errors = state.errors;

  const setLevel = (index: number, change: Partial<RubricLevel>) => {
    setLevels(levels.map((level, i) => (i === index ? { ...level, ...change } : level)));
  };
  const setCriterion = (index: number, change: Partial<RubricCriterion>) => {
    setCriteria(criteria.map((row, i) => (i === index ? { ...row, ...change } : row)));
  };
  const setCell = (row: number, column: number, value: string) => {
    setCriterion(row, {
      descriptors: (criteria[row]?.descriptors ?? []).map((cell, i) =>
        i === column ? value : cell,
      ),
    });
  };
  const addLevel = () => {
    const lowest = levels.at(-1)?.points ?? 1;
    setLevels([
      ...levels,
      {
        label: t('rubrics.levelName', { points: Math.max(lowest - 1, 0) }),
        points: Math.max(lowest - 1, 0),
      },
    ]);
    setCriteria(
      criteria.map((row) => ({ ...row, descriptors: resize(row.descriptors, levels.length + 1) })),
    );
  };
  const removeLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index));
    setCriteria(
      criteria.map((row) => ({
        ...row,
        descriptors: row.descriptors.filter((_, i) => i !== index),
      })),
    );
  };
  const addCriterion = () => {
    setCriteria([
      ...criteria,
      {
        name: t('rubrics.criterionName', { position: criteria.length + 1 }),
        descriptors: resize([], levels.length),
      },
    ]);
  };

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
      <div className="field-row">
        <Field
          id="title"
          name="title"
          label={t('rubrics.title')}
          defaultValue={props.rubric.title}
          required
        />
        <SubjectAndGrade
          locale={props.locale}
          errors={errors}
          subject={props.rubric.subject}
          grade={props.rubric.grade}
        />
      </div>
      <div className="table-scroll">
        <table className="rubric-grid">
          <thead>
            <tr>
              <th scope="col">{t('rubrics.criterion')}</th>
              {levels.map((level, column) => (
                <th scope="col" key={column}>
                  <input
                    aria-label={t('rubrics.levelLabel', { n: column + 1 })}
                    value={level.label}
                    onChange={(event) => {
                      setLevel(column, { label: event.target.value });
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    aria-label={t('rubrics.levelPoints', { n: column + 1 })}
                    value={level.points}
                    onChange={(event) => {
                      setLevel(column, { points: Number(event.target.value) });
                    }}
                  />
                  {levels.length > rubricLevelRange.min ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        removeLevel(column);
                      }}
                    >
                      {t('rubrics.removeLevel')}
                    </button>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">
                  <input
                    aria-label={t('rubrics.criterionLabel', { n: rowIndex + 1 })}
                    value={row.name}
                    onChange={(event) => {
                      setCriterion(rowIndex, { name: event.target.value });
                    }}
                  />
                  {criteria.length > rubricCriteriaRange.min ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setCriteria(criteria.filter((_, i) => i !== rowIndex));
                      }}
                    >
                      {t('rubrics.removeCriterion')}
                    </button>
                  ) : null}
                </th>
                {levels.map((_, column) => (
                  <td key={column}>
                    <textarea
                      rows={3}
                      aria-label={t('rubrics.cell', {
                        criterion: row.name,
                        level: levels[column]?.label ?? '',
                      })}
                      value={row.descriptors[column] ?? ''}
                      onChange={(event) => {
                        setCell(rowIndex, column, event.target.value);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="actions">
        {criteria.length < rubricCriteriaRange.max ? (
          <button type="button" className="button secondary" onClick={addCriterion}>
            {t('rubrics.addCriterion')}
          </button>
        ) : null}
        {levels.length < rubricLevelRange.max ? (
          <button type="button" className="button secondary" onClick={addLevel}>
            {t('rubrics.addLevel')}
          </button>
        ) : null}
      </p>
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
