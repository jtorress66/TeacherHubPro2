'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  activityTypes,
  addDays,
  dokLevels,
  ecaMarks,
  folderColors,
  gradeLevels,
  materialTypes,
  maxSkills,
  planWeekdays,
  standardSubjects,
  subjectIntegrations,
  type LocalDate,
  type PlanBodyInput,
  type PlanDayInput,
  type PlanWeekInput,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  folderAction,
  planCommandAction,
  requestDraftAction,
  savePlanAction,
  type PlannerFormState,
} from '../app/_lib/planner-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: PlannerFormState = {};

interface Option {
  readonly id: string;
  readonly name: string;
}

function Hidden({ values }: { readonly values: Readonly<Record<string, string>> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function ErrorText({
  id,
  message,
}: {
  readonly id: string;
  readonly message?: string | undefined;
}) {
  return message ? (
    <p id={`${id}-error`} className="field-error">
      {message}
    </p>
  ) : null;
}

function TextArea(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string | null | undefined;
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly rows?: number;
}) {
  const { id, name, label, defaultValue, error, hint, rows = 3 } = props;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      <ErrorText id={id} message={error} />
    </div>
  );
}

function Checks<T extends string | number>(props: {
  readonly legend: string;
  readonly name: string;
  readonly values: readonly T[];
  readonly chosen: readonly (string | number)[] | undefined;
  readonly label: (value: T) => string;
  readonly error?: string | undefined;
}) {
  const chosen = new Set(props.chosen ?? []);
  return (
    <fieldset className="checks">
      <legend>{props.legend}</legend>
      {props.values.map((value) => (
        <label key={String(value)} className="checkbox">
          <input
            type="checkbox"
            name={props.name}
            value={String(value)}
            defaultChecked={chosen.has(value)}
          />{' '}
          {props.label(value)}
        </label>
      ))}
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </fieldset>
  );
}

function Select(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly options: readonly Option[];
  readonly empty?: string;
  readonly defaultValue?: string | null | undefined;
  readonly error?: string | undefined;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <select id={props.id} name={props.name} defaultValue={props.defaultValue ?? ''}>
        {props.empty === undefined ? null : <option value="">{props.empty}</option>}
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <ErrorText id={props.id} message={props.error} />
    </div>
  );
}

type Errors = Readonly<Record<string, string>> | undefined;

function DayFields(props: {
  readonly locale: Locale;
  readonly prefix: string;
  readonly weekday: (typeof planWeekdays)[number];
  readonly day: PlanDayInput | undefined;
  readonly errors: Errors;
}) {
  const t = createTranslator(props.locale);
  const { prefix, day, errors } = props;
  const notes = new Map((day?.activities ?? []).map((a) => [a.type, a.notes ?? '']));
  const dayName = t(`planner.day_${props.weekday}`);
  return (
    <details className="plan-day card" open={Boolean(day?.theme ?? day?.notes)}>
      <summary>
        {dayName}
        {day?.theme ? `: ${day.theme}` : ''}
      </summary>
      <Field
        id={`${prefix}.theme`}
        name={`${prefix}.theme`}
        label={`${t('planner.theme')} (${dayName})`}
        defaultValue={day?.theme}
        error={errors?.[`${prefix}.theme`]}
      />
      <Checks
        legend={t('planner.dok')}
        name={`${prefix}.dok`}
        values={dokLevels}
        chosen={day?.dok}
        label={(level) => t(`planner.dok_${String(level) as '1'}`)}
      />
      <Checks
        legend={t('planner.eca')}
        name={`${prefix}.eca`}
        values={ecaMarks}
        chosen={day?.eca}
        label={(mark) => t(`planner.eca_${mark}`)}
      />
      <fieldset className="checks">
        <legend>{t('planner.activities')}</legend>
        {activityTypes.map((type) => (
          <div key={type} className="activity">
            <label className="checkbox">
              <input
                type="checkbox"
                name={`${prefix}.activities`}
                value={type}
                defaultChecked={notes.has(type)}
              />{' '}
              {t(`planner.activity_${type}`)}
            </label>
            <input
              name={`${prefix}.activity.${type}`}
              aria-label={t('planner.activityNotes', { activity: t(`planner.activity_${type}`) })}
              defaultValue={notes.get(type) ?? ''}
            />
          </div>
        ))}
      </fieldset>
      <Checks
        legend={t('planner.materials')}
        name={`${prefix}.materials`}
        values={materialTypes}
        chosen={day?.materials}
        label={(material) => t(`planner.material_${material}`)}
      />
      <TextArea
        id={`${prefix}.notes`}
        name={`${prefix}.notes`}
        label={`${t('planner.notes')} (${dayName})`}
        hint={t('planner.notesHint')}
        defaultValue={day?.notes}
        rows={6}
        error={errors?.[`${prefix}.notes`]}
      />
    </details>
  );
}

function WeekFields(props: {
  readonly locale: Locale;
  readonly index: number;
  readonly week: PlanWeekInput;
  readonly errors: Errors;
}) {
  const t = createTranslator(props.locale);
  const { week, errors } = props;
  const prefix = `w${String(props.index)}`;
  return (
    <fieldset className="stack plan-week">
      <legend>{t('planner.week', { number: props.index + 1 })}</legend>
      <Field
        id={`${prefix}.weekStart`}
        name={`${prefix}.weekStart`}
        type="date"
        label={t('planner.weekStart')}
        defaultValue={week.weekStart}
        error={errors?.[`${prefix}.weekStart`]}
      />
      <TextArea
        id={`${prefix}.objective`}
        name={`${prefix}.objective`}
        label={t('planner.objective')}
        defaultValue={week.objective}
        error={errors?.[`${prefix}.objective`]}
      />
      <fieldset className="field-row">
        <legend>{t('planner.skills')}</legend>
        {Array.from({ length: maxSkills }, (_, i) => (
          <Field
            key={i}
            id={`${prefix}.skill.${String(i)}`}
            name={`${prefix}.skill.${String(i)}`}
            label={t('planner.skill', { number: i + 1 })}
            defaultValue={week.skills?.[i]}
          />
        ))}
        <ErrorText id={`${prefix}.skills`} message={errors?.[`${prefix}.skills`]} />
      </fieldset>
      <TextArea
        id={`${prefix}.standards`}
        name={`${prefix}.standards`}
        label={t('planner.standards')}
        hint={t('planner.standardsHint')}
        defaultValue={(week.standards ?? []).join('\n')}
        error={errors?.[`${prefix}.standards`]}
      />
      <p>
        <a href={`/${props.locale}/app/standards`} target="_blank" rel="noreferrer">
          {t('planner.browseStandards')}
        </a>
      </p>
      <TextArea
        id={`${prefix}.expectations`}
        name={`${prefix}.expectations`}
        label={t('planner.expectations')}
        defaultValue={week.expectations}
      />
      {planWeekdays.map((weekday, j) => (
        <DayFields
          key={weekday}
          locale={props.locale}
          prefix={`${prefix}.d${String(j)}`}
          weekday={weekday}
          day={week.days?.[j]}
          errors={errors}
        />
      ))}
    </fieldset>
  );
}

function WeeklyFields(props: {
  readonly locale: Locale;
  readonly body: Extract<PlanBodyInput, { kind: 'weekly' }>;
  readonly errors: Errors;
}) {
  const t = createTranslator(props.locale);
  const { body, errors } = props;
  const [first, second] = body.weeks;
  const [hasWeek2, setHasWeek2] = useState(second !== undefined);
  const week1 = first ?? { weekStart: '' };
  const week2 = second ?? {
    weekStart: week1.weekStart === '' ? '' : addDays(week1.weekStart as LocalDate, 7),
  };
  return (
    <>
      <div className="field-row">
        <Field
          id="unit"
          name="unit"
          label={t('planner.unit')}
          defaultValue={body.unit}
          error={errors?.unit}
        />
        <Field id="story" name="story" label={t('planner.story')} defaultValue={body.story} />
        <Field
          id="teacherName"
          name="teacherName"
          label={t('planner.teacherName')}
          defaultValue={body.teacherName}
        />
      </div>
      <Checks
        legend={t('planner.subjectIntegration')}
        name="subjectIntegration"
        values={subjectIntegrations}
        chosen={body.subjectIntegration}
        label={(subject) => t(`planner.subject_${subject}`)}
      />
      <FormAlert message={errors?.weeks} />
      <WeekFields locale={props.locale} index={0} week={week1} errors={errors} />
      <label className="checkbox">
        <input
          type="checkbox"
          name="hasWeek2"
          checked={hasWeek2}
          onChange={(event) => {
            setHasWeek2(event.target.checked);
          }}
        />{' '}
        {t('planner.addWeek2')}
      </label>
      {hasWeek2 ? (
        <WeekFields locale={props.locale} index={1} week={week2} errors={errors} />
      ) : null}
    </>
  );
}

function ConversationalFields(props: {
  readonly locale: Locale;
  readonly body: Extract<PlanBodyInput, { kind: 'conversational_english' }>;
  readonly errors: Errors;
}) {
  const t = createTranslator(props.locale);
  const { body, errors } = props;
  const date = (name: 'lessonDate' | 'lessonDateEnd' | 'testQuizDate', label: string) => (
    <Field
      id={name}
      name={name}
      type="date"
      label={label}
      defaultValue={body[name]}
      error={errors?.[name]}
    />
  );
  const long = (
    name: 'learningObjectives' | 'materials' | 'hook' | 'learningGoal' | 'closure' | 'notes',
    label: string,
    rows = 3,
  ) => (
    <TextArea
      id={name}
      name={name}
      label={label}
      defaultValue={body[name]}
      rows={rows}
      error={errors?.[name]}
      {...(name === 'notes' ? { hint: t('planner.notesHint') } : {})}
    />
  );
  return (
    <>
      <div className="field-row">
        <Field
          id="subject"
          name="subject"
          label={t('planner.ceSubject')}
          defaultValue={body.subject}
        />
        <Field
          id="topic"
          name="topic"
          label={t('planner.topic')}
          defaultValue={body.topic}
          error={errors?.topic}
        />
      </div>
      <div className="field-row">
        {date('lessonDate', t('planner.lessonDate'))}
        {date('lessonDateEnd', t('planner.lessonDateEnd'))}
        {date('testQuizDate', t('planner.testQuizDate'))}
      </div>
      {long('learningObjectives', t('planner.learningObjectives'))}
      {long('materials', t('planner.ceMaterials'))}
      {long('hook', t('planner.hook'))}
      {long('learningGoal', t('planner.learningGoal'))}
      {long('notes', t('planner.ceNotes'), 8)}
      {long('closure', t('planner.closure'))}
    </>
  );
}

export interface PlanEditorProps {
  readonly locale: Locale;
  readonly planId: string;
  readonly title: string | null;
  readonly classId: string | null;
  readonly folderId: string | null;
  readonly body: PlanBodyInput;
  readonly classes: readonly Option[];
  readonly folders: readonly Option[];
  readonly savedOnLoad?: boolean;
}

/** The whole plan: header, weeks and days (or the Conversational English sections). */
export function PlanEditor(props: PlanEditorProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(savePlanAction, initial);
  const errors = state.errors;
  const saved = state.saved ?? (props.savedOnLoad && !errors);
  return (
    <form
      action={action}
      className="stack plan-editor"
      noValidate
      aria-label={t('planner.editTitle')}
    >
      <Hidden values={{ locale: props.locale, planId: props.planId, kind: props.body.kind }} />
      <FormAlert message={errors?.form} />
      {saved ? (
        <p role="status" className="notice">
          {t('planner.saved')}
        </p>
      ) : null}
      <div className="field-row">
        <Field
          id="title"
          name="title"
          label={t('planner.planTitle')}
          hint={t('planner.titleHint')}
          defaultValue={props.title}
          error={errors?.title}
        />
        <Select
          id="classId"
          name="classId"
          label={t('planner.class')}
          empty={t('planner.noClass')}
          options={props.classes}
          defaultValue={props.classId}
          error={errors?.classId}
        />
        <Select
          id="folderId"
          name="folderId"
          label={t('planner.folder')}
          empty={t('planner.noFolder')}
          options={props.folders}
          defaultValue={props.folderId}
          error={errors?.folderId}
        />
      </div>
      {props.body.kind === 'weekly' ? (
        <WeeklyFields locale={props.locale} body={props.body} errors={errors} />
      ) : (
        <ConversationalFields locale={props.locale} body={props.body} errors={errors} />
      )}
      <Submit label={t('planner.save')} />
    </form>
  );
}

/** Duplicate, move, save as template and delete, for a saved plan. */
export function PlanCommands(props: {
  readonly locale: Locale;
  readonly planId: string;
  readonly folderId: string | null;
  readonly nextStart: string;
  readonly folders: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(planCommandAction, initial);
  const hidden = { locale: props.locale, planId: props.planId };
  return (
    <div className="stack no-print">
      <FormAlert message={state.errors?.form ?? state.errors?.name} />
      <form action={action} className="field-row" aria-label={t('planner.duplicate')}>
        <Hidden values={{ ...hidden, intent: 'duplicate' }} />
        <Field
          id="duplicate-start"
          name="start"
          type="date"
          label={t('planner.duplicateStart')}
          defaultValue={props.nextStart}
          error={state.errors?.start ?? state.errors?.['w0.weekStart'] ?? state.errors?.lessonDate}
        />
        <Submit label={t('planner.duplicate')} />
      </form>
      <form action={action} className="field-row" aria-label={t('planner.move')}>
        <Hidden values={{ ...hidden, intent: 'move' }} />
        <Select
          id="move-folder"
          name="folderId"
          label={t('planner.folder')}
          empty={t('planner.noFolder')}
          options={props.folders}
          defaultValue={props.folderId}
        />
        <Submit label={t('planner.move')} />
      </form>
      <form action={action} className="field-row" aria-label={t('planner.saveAsTemplate')}>
        <Hidden values={{ ...hidden, intent: 'template' }} />
        <Field id="template-name" name="name" label={t('planner.templateName')} />
        <Submit label={t('planner.saveAsTemplate')} />
      </form>
      {state.saved ? (
        <p role="status" className="notice">
          {t('planner.saved')}
        </p>
      ) : null}
      <form action={action}>
        <Hidden values={{ ...hidden, intent: 'delete' }} />
        <button type="submit" className="button secondary">
          {t('planner.delete')}
        </button>
      </form>
    </div>
  );
}

const colorOptions = (locale: Locale): Option[] => {
  const t = createTranslator(locale);
  return folderColors.map((color) => ({ id: color, name: t(`folders.color_${color}`) }));
};

export function NewFolderForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(folderAction, initial);
  return (
    <form
      key={state.version}
      action={action}
      className="field-row"
      aria-label={t('folders.create')}
      noValidate
    >
      <Hidden values={{ locale, intent: 'create' }} />
      <FormAlert message={state.errors?.form} />
      <Field
        id="new-folder-name"
        name="name"
        label={t('folders.name')}
        error={state.errors?.name}
      />
      <Select
        id="new-folder-color"
        name="color"
        label={t('folders.color')}
        options={colorOptions(locale)}
      />
      <Submit label={t('folders.create')} />
    </form>
  );
}

export function FolderRow(props: {
  readonly locale: Locale;
  readonly folder: { readonly id: string; readonly name: string; readonly color: string };
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(folderAction, initial);
  const { folder } = props;
  return (
    <form
      action={action}
      className="field-row"
      aria-label={t('folders.renameNamed', { name: folder.name })}
    >
      <Hidden values={{ locale: props.locale, folderId: folder.id }} />
      <FormAlert message={state.errors?.form} />
      <Field
        id={`folder-${folder.id}-name`}
        name="name"
        label={t('folders.name')}
        defaultValue={folder.name}
        error={state.errors?.name}
      />
      <Select
        id={`folder-${folder.id}-color`}
        name="color"
        label={t('folders.color')}
        options={colorOptions(props.locale)}
        defaultValue={folder.color}
      />
      <button type="submit" name="intent" value="update" className="button secondary">
        {t('folders.save')}
      </button>
      <button
        type="submit"
        name="intent"
        value="delete"
        className="button secondary"
        title={t('folders.deleteHint')}
      >
        {t('folders.delete')}
      </button>
    </form>
  );
}

/** What to ask the AI for: kind, subject, grade, topic and the week. */
export function DraftForm(props: {
  readonly locale: Locale;
  readonly classes: readonly Option[];
  readonly nextMonday: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestDraftAction, initial);
  const errors = state.errors;
  const option = (id: string, name: string): Option => ({ id, name });
  return (
    <form action={action} className="stack" noValidate aria-label={t('drafts.title')}>
      <Hidden values={{ locale: props.locale }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        <Select
          id="kind"
          name="kind"
          label={t('drafts.kind')}
          options={[
            option('weekly', t('planner.kind_weekly')),
            option('conversational_english', t('planner.kind_conversational_english')),
          ]}
          defaultValue="weekly"
        />
        <Select
          id="subject"
          name="subject"
          label={t('drafts.subject')}
          options={standardSubjects.map((s) => option(s, t(`drafts.subject_${s}`)))}
          defaultValue="math"
          error={errors?.subject}
        />
        <Select
          id="grade"
          name="grade"
          label={t('drafts.grade')}
          options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
          defaultValue="4"
          error={errors?.grade}
        />
      </div>
      <Field id="topic" name="topic" label={t('drafts.topic')} error={errors?.topic} required />
      <div className="field-row">
        <Select
          id="difficulty"
          name="difficulty"
          label={t('drafts.difficulty')}
          options={(['easy', 'medium', 'hard'] as const).map((d) =>
            option(d, t(`drafts.difficulty_${d}`)),
          )}
          defaultValue="medium"
        />
        <Field
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={15}
          label={t('drafts.duration')}
          defaultValue={45}
          error={errors?.durationMinutes}
        />
        <Field
          id="start"
          name="start"
          type="date"
          label={t('drafts.start')}
          defaultValue={props.nextMonday}
          error={errors?.start}
        />
        <Select
          id="classId"
          name="classId"
          label={t('drafts.class')}
          empty={t('planner.noClass')}
          options={props.classes}
          error={errors?.classId}
        />
      </div>
      <TextArea
        id="instructions"
        name="instructions"
        label={t('drafts.instructions')}
        error={errors?.instructions}
      />
      <Submit label={t('drafts.submit')} />
    </form>
  );
}

interface JobStatusReply {
  readonly status: 'queued' | 'running' | 'completed' | 'failed';
  readonly message?: string;
}

/** Polls the draft job and opens the drafted plan when it is ready. */
export function DraftProgress(props: {
  readonly locale: Locale;
  readonly jobId: string;
  readonly intervalMs?: number;
}) {
  const t = createTranslator(props.locale);
  const router = useRouter();
  const [reply, setReply] = useState<JobStatusReply>({ status: 'queued' });
  const plans = `/${props.locale}/app/plans`;

  useEffect(() => {
    if (reply.status === 'completed' || reply.status === 'failed') return;
    const timer = setTimeout(() => {
      fetch(`/api/jobs/${props.jobId}?locale=${props.locale}`, { cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<JobStatusReply>) : null))
        .then((next) => {
          if (next) setReply(next);
        })
        .catch(() => undefined);
    }, props.intervalMs ?? 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [reply, props.jobId, props.locale, props.intervalMs]);

  useEffect(() => {
    if (reply.status === 'completed') router.push(`${plans}/new?draft=${props.jobId}`);
  }, [reply.status, router, plans, props.jobId]);

  if (reply.status === 'failed') {
    return (
      <div className="stack">
        <p role="alert" className="alert">
          {reply.message ?? t('drafts.failed')}
        </p>
        <p>
          <a className="button" href={`${plans}/draft`}>
            {t('drafts.tryAgain')}
          </a>
        </p>
      </div>
    );
  }
  return (
    <p role="status" className="notice" aria-live="polite">
      {reply.status === 'completed' ? (
        <a href={`${plans}/new?draft=${props.jobId}`}>{t('drafts.open')}</a>
      ) : (
        t('drafts.working')
      )}
    </p>
  );
}
