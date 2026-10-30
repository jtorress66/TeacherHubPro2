'use client';

import { useActionState } from 'react';
import type { Assignment, GradeCategory, GradeStatus } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  addCategoryAction,
  saveAssignmentAction,
  saveCommentAction,
  saveGradesAction,
  updateCategoryAction,
  uploadLogoAction,
  type GradebookFormState,
} from '../app/_lib/gradebook-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: GradebookFormState = {};

function Saved({ message }: { readonly message: string | false | undefined }) {
  return message ? (
    <p role="status" className="notice">
      {message}
    </p>
  ) : null;
}

interface ClassFormProps {
  readonly locale: Locale;
  readonly classId: string;
}

function Hidden({ locale, classId }: ClassFormProps) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="classId" value={classId} />
    </>
  );
}

export function AddCategoryForm(props: ClassFormProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(addCategoryAction, initial);
  return (
    <form
      key={state.version}
      action={action}
      className="field-row"
      noValidate
      aria-label={t('gradebook.addCategory')}
    >
      <Hidden {...props} />
      <FormAlert message={state.errors?.form} />
      <Field
        id="new-category-name"
        label={t('gradebook.categoryName')}
        name="name"
        error={state.errors?.name}
      />
      <Field
        id="new-category-weight"
        label={t('gradebook.weight')}
        name="weightPercent"
        type="number"
        min={0}
        defaultValue={10}
        error={state.errors?.weightPercent}
      />
      <Submit label={t('gradebook.addCategory')} />
    </form>
  );
}

/** One category's name and weight, with Save and Delete. */
export function CategoryRow(props: ClassFormProps & { readonly category: GradeCategory }) {
  const t = createTranslator(props.locale);
  const { category } = props;
  const [state, action] = useActionState(updateCategoryAction, initial);
  const id = `category-${category.id}`;
  return (
    <tr>
      <td colSpan={3}>
        <form action={action} className="field-row" noValidate>
          <Hidden {...props} />
          <input type="hidden" name="categoryId" value={category.id} />
          <div className="field">
            <label htmlFor={`${id}-name`} className="visually-hidden">
              {t('gradebook.nameOf', { name: category.name })}
            </label>
            <input
              id={`${id}-name`}
              name="name"
              defaultValue={category.name}
              aria-invalid={state.errors?.name ? true : undefined}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-weight`} className="visually-hidden">
              {t('gradebook.weightFor', { name: category.name })}
            </label>
            <input
              id={`${id}-weight`}
              name="weightPercent"
              type="number"
              min={0}
              max={100}
              step="any"
              className="narrow-input"
              defaultValue={category.weightPercent}
              aria-invalid={state.errors?.weightPercent ? true : undefined}
            />
          </div>
          <button type="submit" name="intent" value="save" className="button secondary">
            {t('gradebook.saveCategory')}
          </button>
          <button
            type="submit"
            name="intent"
            value="delete"
            className="button secondary"
            aria-label={t('gradebook.deleteCategoryNamed', { name: category.name })}
          >
            {t('gradebook.deleteCategory')}
          </button>
          <FormAlert
            message={state.errors?.form ?? state.errors?.name ?? state.errors?.weightPercent}
          />
        </form>
      </td>
    </tr>
  );
}

/** A new assignment, or edits to one when `assignment` is given. */
export function AssignmentForm(
  props: ClassFormProps & {
    readonly categories: readonly GradeCategory[];
    readonly assignment?: Assignment;
  },
) {
  const t = createTranslator(props.locale);
  const { assignment } = props;
  const [state, action] = useActionState(saveAssignmentAction, initial);
  const label = assignment ? t('gradebook.editAssignment') : t('gradebook.newAssignment');
  return (
    <form
      key={assignment ? undefined : state.version}
      action={action}
      className="stack"
      noValidate
      aria-label={label}
    >
      <Hidden {...props} />
      <input type="hidden" name="assignmentId" value={assignment?.id ?? ''} />
      <FormAlert message={state.errors?.form} />
      <Saved message={assignment && state.saved && t('settings.saved')} />
      <div className="field-row">
        <Field
          id="assignment-title"
          label={t('gradebook.assignmentTitle')}
          name="title"
          defaultValue={assignment?.title}
          error={state.errors?.title}
          required
        />
        <div className="field">
          <label htmlFor="assignment-category">{t('gradebook.category')}</label>
          <select
            id="assignment-category"
            name="categoryId"
            defaultValue={assignment?.categoryId}
            aria-invalid={state.errors?.categoryId ? true : undefined}
          >
            {props.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {state.errors?.categoryId ? (
            <p className="field-error">{state.errors.categoryId}</p>
          ) : null}
        </div>
        <Field
          id="assignment-points"
          label={t('gradebook.points')}
          name="points"
          type="number"
          min={1}
          defaultValue={assignment?.points ?? 100}
          hint={t('gradebook.pointsHint')}
          error={state.errors?.points}
        />
        <Field
          id="assignment-due"
          label={t('gradebook.dueDate')}
          name="dueDate"
          type="date"
          defaultValue={assignment?.dueDate}
          error={state.errors?.dueDate}
        />
      </div>
      <Submit
        label={assignment ? t('gradebook.saveAssignment') : t('gradebook.createAssignment')}
      />
    </form>
  );
}

export interface GradeEntryRowView {
  readonly studentId: string;
  readonly name: string;
  readonly status: GradeStatus | null;
  readonly score: number | null;
  readonly comment: string | null;
}

/** The choice shown for a saved status: graded and pending both follow the score. */
const choiceOf = (status: GradeStatus | null): string =>
  status === 'late' || status === 'missing' || status === 'excused' ? status : '';

export function GradeEntryForm(
  props: ClassFormProps & {
    readonly assignmentId: string;
    readonly maxPoints: number;
    readonly editable: boolean;
    readonly rows: readonly GradeEntryRowView[];
  },
) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveGradesAction, initial);
  const choices: { value: string; label: string }[] = [
    { value: '', label: t('gradebook.status_graded') },
    { value: 'late', label: t('gradebook.status_late') },
    { value: 'missing', label: t('gradebook.status_missing') },
    { value: 'excused', label: t('gradebook.status_excused') },
  ];
  return (
    <form action={action} className="stack grade-entry" noValidate>
      <Hidden {...props} />
      <input type="hidden" name="assignmentId" value={props.assignmentId} />
      <FormAlert message={state.errors?.form} />
      <Saved message={state.saved && !state.errors && t('gradebook.gradesSaved')} />
      <p className="muted">{t('gradebook.entryHelp')}</p>
      <table className="roster">
        <thead>
          <tr>
            <th scope="col">{t('gradebook.student')}</th>
            <th scope="col">
              {t('gradebook.score')}{' '}
              <span className="muted">({t('gradebook.outOf', { points: props.maxPoints })})</span>
            </th>
            <th scope="col">{t('gradebook.status')}</th>
            <th scope="col">{t('gradebook.comment')}</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => {
            const error = state.errors?.[`score.${row.studentId}`];
            return (
              <tr key={row.studentId} data-testid="grade-row">
                <th scope="row">{row.name}</th>
                <td>
                  <input
                    name={`score.${row.studentId}`}
                    type="number"
                    min={0}
                    step="any"
                    className="narrow-input"
                    defaultValue={row.score ?? undefined}
                    disabled={!props.editable}
                    aria-label={t('gradebook.scoreFor', { name: row.name })}
                    aria-invalid={error ? true : undefined}
                  />
                  {error ? <p className="field-error">{error}</p> : null}
                </td>
                <td>
                  <select
                    name={`status.${row.studentId}`}
                    defaultValue={choiceOf(row.status)}
                    disabled={!props.editable}
                    aria-label={t('gradebook.statusFor', { name: row.name })}
                  >
                    {choices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    name={`comment.${row.studentId}`}
                    defaultValue={row.comment ?? undefined}
                    disabled={!props.editable}
                    aria-label={t('gradebook.commentFor', { name: row.name })}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {props.editable ? <Submit label={t('gradebook.saveGrades')} /> : null}
    </form>
  );
}

export function CommentForm(
  props: ClassFormProps & {
    readonly studentId: string;
    readonly name: string;
    readonly comment: string | null;
    readonly editable: boolean;
  },
) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveCommentAction, initial);
  const id = `comment-${props.studentId}`;
  return (
    <form action={action} className="stack" noValidate>
      <Hidden {...props} />
      <input type="hidden" name="studentId" value={props.studentId} />
      <label htmlFor={id}>{t('reportCards.commentFor', { name: props.name })}</label>
      <textarea
        id={id}
        name="comment"
        rows={3}
        maxLength={1000}
        defaultValue={props.comment ?? undefined}
        disabled={!props.editable}
        aria-describedby={`${id}-hint`}
        aria-invalid={state.errors?.comment ? true : undefined}
      />
      <p id={`${id}-hint`} className="hint">
        {state.errors?.comment ?? t('reportCards.commentHint')}
      </p>
      <FormAlert message={state.errors?.form} />
      <Saved message={state.saved && !state.errors && t('reportCards.commentSaved')} />
      {props.editable ? <Submit label={t('reportCards.saveComment')} /> : null}
    </form>
  );
}

export function LogoForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(uploadLogoAction, initial);
  return (
    <form key={state.version} action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="field">
        <label htmlFor="logo">{t('settings.logoFile')}</label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg"
          aria-describedby="logo-hint"
          aria-invalid={state.errors?.logo ? true : undefined}
        />
        <p id="logo-hint" className={state.errors?.logo ? 'field-error' : 'hint'}>
          {state.errors?.logo ?? t('settings.logoHint')}
        </p>
      </div>
      <FormAlert message={state.errors?.form} />
      <Saved message={state.saved && t('settings.logoSaved')} />
      <Submit label={t('settings.uploadLogo')} />
    </form>
  );
}
