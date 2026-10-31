'use client';

import { useActionState, useState } from 'react';
import { questionTypes, type Question, type QuestionType } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { saveQuestionsAction, type AssignmentFormState } from '../app/_lib/assignment-actions.ts';
import {
  blankDraft,
  draftOf,
  inputOf,
  nextQuestionId,
  type QuestionDraft,
} from '../server/question-drafts.ts';
import { FormAlert, Submit } from './forms.tsx';
import { Hidden } from './form-fields.tsx';

const initial: AssignmentFormState = {};

function Area(props: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly rows?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <textarea
        id={props.id}
        rows={props.rows ?? 2}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </div>
  );
}

/** The fields that differ by question type. */
function TypeFields(props: {
  readonly locale: Locale;
  readonly draft: QuestionDraft;
  readonly change: (patch: Partial<QuestionDraft>) => void;
}) {
  const t = createTranslator(props.locale);
  const { draft, change } = props;
  const id = (field: string) => `${draft.id}-${field}`;
  if (draft.type === 'multiple_choice') {
    const options = draft.optionsText.split('\n').filter((line) => line.trim() !== '');
    return (
      <>
        <Area
          id={id('options')}
          label={t('questions.options')}
          value={draft.optionsText}
          rows={4}
          onChange={(optionsText) => {
            change({ optionsText });
          }}
        />
        <div className="field">
          <label htmlFor={id('correct')}>{t('questions.correctOption')}</label>
          <select
            id={id('correct')}
            value={draft.correctOption}
            onChange={(event) => {
              change({ correctOption: Number(event.target.value) });
            }}
          >
            {options.map((option, index) => (
              <option key={index} value={index}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }
  if (draft.type === 'true_false') {
    return (
      <div className="field">
        <label htmlFor={id('answer')}>{t('questions.answer')}</label>
        <select
          id={id('answer')}
          value={String(draft.answer)}
          onChange={(event) => {
            change({ answer: event.target.value === 'true' });
          }}
        >
          <option value="true">{t('questions.true')}</option>
          <option value="false">{t('questions.false')}</option>
        </select>
      </div>
    );
  }
  const text: Record<string, [keyof QuestionDraft, Parameters<typeof t>[0]]> = {
    fill_blank: ['acceptedText', 'questions.acceptedAnswers'],
    short_answer: ['modelAnswer', 'questions.modelAnswer'],
    matching: ['pairsText', 'questions.pairs'],
    essay: ['rubric', 'questions.rubric'],
  };
  const entry = text[draft.type];
  if (entry === undefined) return null;
  const [field, label] = entry;
  return (
    <Area
      id={id(field)}
      label={t(label)}
      value={String(draft[field])}
      rows={3}
      onChange={(value) => {
        change({ [field]: value });
      }}
    />
  );
}

/**
 * Builds an assignment's questions in the browser and saves them, with the instructions, at once.
 * Imported questions come prefilled and are saved only when the teacher saves.
 */
export function QuestionBuilder(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly assignmentId: string;
  readonly questions: readonly Question[];
  readonly instructions: string | null;
  readonly locked: boolean;
  readonly imported?: boolean;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveQuestionsAction, initial);
  const [drafts, setDrafts] = useState<readonly QuestionDraft[]>(props.questions.map(draftOf));
  const [instructions, setInstructions] = useState(props.instructions ?? '');
  const [newType, setNewType] = useState<QuestionType>('multiple_choice');

  const change = (index: number) => (patch: Partial<QuestionDraft>) => {
    setDrafts(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= drafts.length) return;
    const next = [...drafts];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    setDrafts(next);
  };

  return (
    <form action={action} className="stack" aria-label={t('questions.title')}>
      <Hidden
        values={{
          locale: props.locale,
          classId: props.classId,
          assignmentId: props.assignmentId,
          questions: JSON.stringify(drafts.map(inputOf)),
          imported: props.imported === true ? '1' : '',
        }}
      />
      {props.imported === true ? (
        <p className="notice" role="note">
          {t('questions.imported')}
        </p>
      ) : null}
      {props.locked ? (
        <p className="notice" role="status">
          {t('questions.locked')}
        </p>
      ) : null}
      <FormAlert
        message={
          state.errors === undefined
            ? undefined
            : Object.entries(state.errors)
                .map(([field, message]) => (field === 'form' ? message : `${field}: ${message}`))
                .join(' ')
        }
      />
      {state.saved ? (
        <p role="status" className="notice">
          {t('questions.saved')}
        </p>
      ) : null}
      <Area
        id="instructions"
        label={t('questions.instructions')}
        value={instructions}
        rows={3}
        onChange={setInstructions}
      />
      <input type="hidden" name="instructions" value={instructions} />
      {drafts.length === 0 ? <p className="muted">{t('questions.empty')}</p> : null}
      <ol className="question-list">
        {drafts.map((draft, index) => (
          <li key={draft.id} className="card stack">
            <fieldset className="stack" disabled={props.locked}>
              <legend>
                {t('questions.question', { number: index + 1 })} ·{' '}
                {t(`questions.type_${draft.type}`)}
              </legend>
              <Area
                id={`${draft.id}-prompt`}
                label={t('questions.prompt')}
                value={draft.prompt}
                onChange={(prompt) => {
                  change(index)({ prompt });
                }}
              />
              <TypeFields locale={props.locale} draft={draft} change={change(index)} />
              <div className="field-row">
                <div className="field">
                  <label htmlFor={`${draft.id}-points`}>{t('questions.points')}</label>
                  <input
                    id={`${draft.id}-points`}
                    type="number"
                    min={0}
                    step="0.5"
                    value={draft.points}
                    onChange={(event) => {
                      change(index)({ points: event.target.value });
                    }}
                  />
                </div>
              </div>
              <Area
                id={`${draft.id}-instructions`}
                label={t('questions.questionInstructions')}
                value={draft.instructions}
                onChange={(value) => {
                  change(index)({ instructions: value });
                }}
              />
              <div className="button-row">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    move(index, index - 1);
                  }}
                >
                  {t('questions.moveUp')}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    move(index, index + 1);
                  }}
                >
                  {t('questions.moveDown')}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setDrafts(drafts.filter((_, i) => i !== index));
                  }}
                >
                  {t('questions.remove')}
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {props.locked ? null : (
        <div className="field-row">
          <div className="field">
            <label htmlFor="new-question-type">{t('questions.type')}</label>
            <select
              id="new-question-type"
              value={newType}
              onChange={(event) => {
                setNewType(event.target.value as QuestionType);
              }}
            >
              {questionTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`questions.type_${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDrafts([...drafts, blankDraft(newType, nextQuestionId(drafts))]);
              }}
            >
              {t('questions.add')}
            </button>
          </div>
        </div>
      )}
      {props.locked ? null : <Submit label={t('questions.save')} />}
    </form>
  );
}
