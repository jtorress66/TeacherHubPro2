'use client';

import { useActionState, useState } from 'react';
import { assistantSubjects, gameCountRange, gradeLevels, gradeMethods } from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  confirmGameGradesAction,
  createGameAction,
  requestGameDraftAction,
  saveGameGradingAction,
  updateGameAction,
  type GameFormState,
} from '../app/_lib/game-actions.ts';
import { gameModeChoices, kindForMode } from '../server/game-forms.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, type Option } from './form-fields.tsx';

const initial: GameFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

function ModeSelect(props: {
  readonly locale: Locale;
  readonly id: string;
  readonly value: string;
  readonly onChange: (mode: string) => void;
  readonly error?: string | undefined;
}) {
  const t = createTranslator(props.locale);
  return (
    <div className="field">
      <label htmlFor={props.id}>{t('games.mode')}</label>
      <select
        id={props.id}
        name="mode"
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        {gameModeChoices.map((mode) => (
          <option key={mode} value={mode}>
            {t(`gameModes.${mode}`)}
          </option>
        ))}
      </select>
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </div>
  );
}

function LanguageSelect({ locale, value }: { readonly locale: Locale; readonly value: string }) {
  const t = createTranslator(locale);
  return (
    <Select
      id="language"
      name="language"
      label={t('games.language')}
      options={locales.map((l) => option(l, localeInfo[l].nativeName))}
      defaultValue={value}
    />
  );
}

export interface GameEditorValues {
  readonly title: string;
  readonly mode: string;
  readonly content: string;
  readonly classId: string | null;
  readonly language: string;
}

/** Creates a game, or saves changes to one (with `gameId`). Content is one item per line. */
export function GameEditor(props: {
  readonly locale: Locale;
  readonly classes: readonly Option[];
  readonly values: GameEditorValues;
  readonly gameId?: string;
  readonly label?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(
    props.gameId === undefined ? createGameAction : updateGameAction,
    initial,
  );
  const [mode, setMode] = useState(props.values.mode);
  const errors = state.errors;
  const kind = kindForMode(mode);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={props.label ?? t('games.newGame')}
    >
      <Hidden values={{ locale: props.locale, gameId: props.gameId ?? '' }} />
      <FormAlert message={errors?.form} />
      {state.message ? (
        <p role="status" className="notice">
          {state.message}
        </p>
      ) : null}
      <Field
        id="game-title"
        name="title"
        label={t('games.titleLabel')}
        defaultValue={props.values.title}
        error={errors?.title}
        required
      />
      <div className="field-row">
        <ModeSelect
          locale={props.locale}
          id="game-mode-choice"
          value={mode}
          onChange={setMode}
          error={errors?.mode}
        />
        <Select
          id="game-class"
          name="classId"
          label={t('games.class')}
          options={props.classes}
          empty={t('games.noClass')}
          defaultValue={props.values.classId}
          error={errors?.classId}
        />
        <LanguageSelect locale={props.locale} value={props.values.language} />
      </div>
      <div className="field">
        <label htmlFor="game-content">
          {t('games.content')} ({t(`games.kind_${kind}`)})
        </label>
        <textarea
          id="game-content"
          name="content"
          rows={10}
          defaultValue={props.values.content}
          aria-invalid={errors?.content ? true : undefined}
          aria-describedby={errors?.content ? 'game-content-error' : 'game-content-hint'}
        />
        {errors?.content ? (
          <p id="game-content-error" className="field-error">
            {errors.content}
          </p>
        ) : (
          <p id="game-content-hint" className="hint">
            {t(`games.contentHint_${kind}`)}
          </p>
        )}
      </div>
      <Submit label={props.gameId === undefined ? t('games.create') : t('games.save')} />
    </form>
  );
}

/** Asks the AI for a new game's content, or (with `gameId`) fresh items for a game. */
export function GameDraftForm(props: {
  readonly locale: Locale;
  readonly gameId?: string;
  readonly mode?: string;
  readonly topic?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestGameDraftAction, initial);
  const [mode, setMode] = useState(props.mode ?? 'quiz');
  const range = gameCountRange(kindForMode(mode));
  const errors = state.errors;
  const label = props.gameId === undefined ? t('games.aiTitle') : t('games.freshTitle');
  return (
    <form action={action} className="stack" noValidate aria-label={label}>
      <Hidden values={{ locale: props.locale, gameId: props.gameId ?? '' }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        {props.gameId === undefined ? (
          <ModeSelect locale={props.locale} id="draft-mode" value={mode} onChange={setMode} />
        ) : (
          <Hidden values={{ mode }} />
        )}
        <Select
          id="draft-subject"
          name="subject"
          label={t('games.subject')}
          options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
          defaultValue="science"
          error={errors?.subject}
        />
        <Select
          id="draft-grade"
          name="grade"
          label={t('games.grade')}
          options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
          defaultValue="4"
          error={errors?.grade}
        />
      </div>
      <div className="field-row">
        <Field
          id="draft-topic"
          name="topic"
          label={t('games.topic')}
          defaultValue={props.topic}
          error={errors?.topic}
          required
        />
        <Field
          id="draft-count"
          name="count"
          type="number"
          min={range.min}
          label={t('games.count')}
          defaultValue={range.default}
          error={errors?.count}
        />
        <LanguageSelect locale={props.locale} value={props.locale} />
      </div>
      <Submit label={t('games.generate')} />
    </form>
  );
}

export function GradingForm(props: {
  readonly locale: Locale;
  readonly gameId: string;
  readonly categories: readonly Option[];
  readonly grading: {
    readonly countAsGrade: boolean;
    readonly method: string;
    readonly points: number;
    readonly categoryId: string | null;
  };
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveGameGradingAction, initial);
  const errors = state.errors;
  return (
    <form action={action} className="stack" noValidate aria-label={t('games.gradingTitle')}>
      <Hidden values={{ locale: props.locale, gameId: props.gameId }} />
      <FormAlert message={errors?.form ?? errors?.classId} />
      {state.message ? (
        <p role="status" className="notice">
          {state.message}
        </p>
      ) : null}
      <label className="checkbox">
        <input type="checkbox" name="countAsGrade" defaultChecked={props.grading.countAsGrade} />{' '}
        {t('games.countAsGrade')}
      </label>
      <div className="field-row">
        <Select
          id="grading-method"
          name="method"
          label={t('games.method')}
          options={gradeMethods.map((m) => option(m, t(`games.method_${m}`)))}
          defaultValue={props.grading.method}
          error={errors?.method}
        />
        <Field
          id="grading-points"
          name="points"
          type="number"
          min={1}
          label={t('games.points')}
          defaultValue={props.grading.points}
          error={errors?.points}
        />
        <Select
          id="grading-category"
          name="categoryId"
          label={t('games.category')}
          options={props.categories}
          empty={t('gamePlay.choose')}
          defaultValue={props.grading.categoryId}
          error={errors?.categoryId}
        />
      </div>
      <Submit label={t('games.saveGrading')} />
    </form>
  );
}

export interface ResultRow {
  readonly studentId: string;
  readonly name: string;
  readonly attempts: number;
  readonly bestPercent: number;
  readonly lastPercent: number;
  readonly lastPlayed: string;
  readonly draftScore: number | null;
  readonly confirmedScore: number | null;
}

/** The class's results; with grading on, the drafts to adjust and confirm in one click. */
export function ResultsForm(props: {
  readonly locale: Locale;
  readonly gameId: string;
  readonly rows: readonly ResultRow[];
  readonly grading: boolean;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(confirmGameGradesAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('games.results')}>
      <Hidden values={{ locale: props.locale, gameId: props.gameId }} />
      <FormAlert message={state.errors?.form ?? state.errors?.score} />
      {state.message ? (
        <p role="status" className="notice">
          {state.message}
        </p>
      ) : null}
      <table className="table">
        <thead>
          <tr>
            <th scope="col">{t('games.student')}</th>
            <th scope="col">{t('games.attempts')}</th>
            <th scope="col">{t('games.best')}</th>
            <th scope="col">{t('games.last')}</th>
            <th scope="col">{t('games.lastPlayed')}</th>
            {props.grading ? <th scope="col">{t('games.draft')}</th> : null}
            {props.grading ? <th scope="col">{t('games.confirmed')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.studentId}>
              <th scope="row">{row.name}</th>
              <td>{row.attempts}</td>
              <td>{row.bestPercent}%</td>
              <td>{row.lastPercent}%</td>
              <td>{row.lastPlayed}</td>
              {props.grading ? (
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    name={`score:${row.studentId}`}
                    aria-label={t('games.scoreFor', { name: row.name })}
                    defaultValue={row.draftScore ?? ''}
                  />
                </td>
              ) : null}
              {props.grading ? <td>{row.confirmedScore ?? '—'}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {props.grading ? (
        <>
          <p className="hint">{t('games.confirmHint')}</p>
          <Submit label={t('games.confirmGrades')} />
        </>
      ) : null}
    </form>
  );
}
