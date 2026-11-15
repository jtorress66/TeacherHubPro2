'use client';

import { useActionState, useState } from 'react';
import {
  assistantSubjects,
  contentMinutesRange,
  contentTypes,
  gradeLevels,
  presentationThemes,
  questionCountRange,
  questionPartSize,
  slideCountRange,
  type SubPacket,
} from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  createPresentationAction,
  requestGenerationAction,
  requestPresentationDraftAction,
  sendPresentationToClassroomAction,
  saveSubPacketAction,
  type AssistantFormState,
} from '../app/_lib/assistant-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { EslSwitch, Hidden, Select, TextArea, type Option } from './form-fields.tsx';
import { ScheduleFields } from './schedule-fields.tsx';
import { prefill, type Prefill } from '../server/form-values.ts';

const initial: AssistantFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

function SubjectAndGrade(props: {
  readonly locale: Locale;
  readonly errors: AssistantFormState['errors'];
  readonly sent: Prefill;
}) {
  const t = createTranslator(props.locale);
  return (
    <>
      <Select
        id="subject"
        name="subject"
        label={t('assistant.subject')}
        options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
        defaultValue={props.sent.text('subject', 'math')}
        error={props.errors?.subject}
      />
      <Select
        id="grade"
        name="grade"
        label={t('assistant.grade')}
        options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
        defaultValue={props.sent.text('grade', '4')}
        error={props.errors?.grade}
      />
    </>
  );
}

function LanguageSelect({ locale, sent }: { readonly locale: Locale; readonly sent: Prefill }) {
  const t = createTranslator(locale);
  return (
    <Select
      id="language"
      name="language"
      label={t('assistant.language')}
      options={locales.map((l) => option(l, localeInfo[l].nativeName))}
      defaultValue={sent.text('language', locale)}
    />
  );
}

/** What the teacher asks the assistant to write. */
export function ContentForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(requestGenerationAction, initial);
  const errors = state.errors;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('assistant.title')}
      key={sent.key}
    >
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        <Select
          id="type"
          name="type"
          label={t('assistant.type')}
          options={contentTypes.map((type) => option(type, t(`assistant.type_${type}`)))}
          defaultValue={sent.text('type', 'worksheet')}
          error={errors?.type}
        />
        <SubjectAndGrade locale={locale} errors={errors} sent={sent} />
      </div>
      <Field
        id="topic"
        name="topic"
        label={t('assistant.topic')}
        defaultValue={sent.text('topic')}
        error={errors?.topic}
        required
      />
      <div className="field-row">
        <Select
          id="difficulty"
          name="difficulty"
          label={t('assistant.difficulty')}
          options={(['easy', 'medium', 'hard'] as const).map((d) =>
            option(d, t(`drafts.difficulty_${d}`)),
          )}
          defaultValue={sent.text('difficulty', 'medium')}
        />
        <Field
          id="questionCount"
          name="questionCount"
          type="number"
          min={questionCountRange.min}
          max={questionCountRange.max}
          label={t('assistant.questionCount')}
          defaultValue={sent.text('questionCount', questionCountRange.default)}
          hint={t('assistant.questionCountHint', {
            min: questionCountRange.min,
            max: questionCountRange.max,
            part: questionPartSize,
          })}
          error={errors?.questionCount}
        />
        <Field
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={contentMinutesRange.min}
          max={contentMinutesRange.max}
          label={t('assistant.duration')}
          defaultValue={sent.text('durationMinutes', contentMinutesRange.default)}
          error={errors?.durationMinutes}
        />
        <LanguageSelect locale={locale} sent={sent} />
      </div>
      <TextArea
        id="instructions"
        name="instructions"
        label={t('assistant.instructions')}
        defaultValue={sent.text('instructions')}
        error={errors?.instructions}
      />
      <EslSwitch
        label={t('esl.label')}
        help={t('esl.assistantHelp')}
        defaultChecked={sent.checked('esl')}
      />
      <Submit label={t('assistant.submit')} />
    </form>
  );
}

/** Copies the content's Markdown to the clipboard. */
export function CopyButton(props: { readonly locale: Locale; readonly text: string }) {
  const t = createTranslator(props.locale);
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => {
        void navigator.clipboard.writeText(props.text).then(() => {
          setCopied(true);
        });
      }}
    >
      {copied ? t('assistant.copied') : t('assistant.copy')}
    </button>
  );
}

/** What the teacher asks the AI to make slides about. */
export function PresentationRequestForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(requestPresentationDraftAction, initial);
  const errors = state.errors;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('presentations.generate')}
      key={sent.key}
    >
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field
        id="topic"
        name="topic"
        label={t('assistant.topic')}
        defaultValue={sent.text('topic')}
        error={errors?.topic}
        required
      />
      <div className="field-row">
        <SubjectAndGrade locale={locale} errors={errors} sent={sent} />
        <Field
          id="slideCount"
          name="slideCount"
          type="number"
          min={slideCountRange.min}
          max={slideCountRange.max}
          label={t('presentations.slideCount')}
          defaultValue={sent.text('slideCount', slideCountRange.default)}
          error={errors?.slideCount}
        />
        <ThemeSelect locale={locale} sent={sent} />
        <LanguageSelect locale={locale} sent={sent} />
      </div>
      <Submit label={t('presentations.draftSubmit')} />
    </form>
  );
}

function ThemeSelect({ locale, sent }: { readonly locale: Locale; readonly sent: Prefill }) {
  const t = createTranslator(locale);
  return (
    <Select
      id="theme"
      name="theme"
      label={t('presentations.theme')}
      options={presentationThemes.map((theme) => option(theme, t(`presentations.theme_${theme}`)))}
      defaultValue={sent.text('theme', 'ocean')}
    />
  );
}

/** Starts a blank presentation with a name and theme. */
export function NewPresentationForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(createPresentationAction, initial);
  const errors = state.errors;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('presentations.newBlank')}
      key={sent.key}
    >
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        <Field
          id="name"
          name="name"
          label={t('presentations.name')}
          defaultValue={sent.text('name')}
          error={errors?.name}
          required
        />
        <ThemeSelect locale={locale} sent={sent} />
      </div>
      <Submit label={t('presentations.create')} />
    </form>
  );
}

/** Keeps a finished slide draft as a new presentation. */
export function KeepDraftForm(props: { readonly locale: Locale; readonly jobId: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(createPresentationAction, initial);
  return (
    <form action={action} className="stack">
      <Hidden values={{ locale: props.locale, jobId: props.jobId }} />
      <FormAlert
        message={state.errors === undefined ? undefined : Object.values(state.errors).join(' ')}
      />
      <Submit label={t('presentations.keep')} />
    </form>
  );
}

/** The notes a teacher keeps for substitutes in one class. */
export function SubPacketForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly notes: SubPacket;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(saveSubPacketAction, initial);
  const errors = state.errors;
  const { notes } = props;
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('subPacket.subNotes')}
      key={sent.key}
    >
      <Hidden values={{ locale: props.locale, classId: props.classId }} />
      <FormAlert message={errors?.form} />
      {state.saved ? (
        <p role="status" className="notice">
          {t('subPacket.saved')}
        </p>
      ) : null}
      <div className="field-row">
        <Field
          id="mainOfficeExt"
          name="mainOfficeExt"
          label={t('subPacket.mainOfficeExt')}
          defaultValue={sent.text('mainOfficeExt', notes.mainOfficeExt)}
          error={errors?.mainOfficeExt}
        />
        <Field
          id="nurseExt"
          name="nurseExt"
          label={t('subPacket.nurseExt')}
          defaultValue={sent.text('nurseExt', notes.nurseExt)}
          error={errors?.nurseExt}
        />
      </div>
      <TextArea
        id="dailyRoutines"
        name="dailyRoutines"
        label={t('subPacket.dailyRoutines')}
        defaultValue={sent.text('dailyRoutines', notes.dailyRoutines)}
        error={errors?.dailyRoutines}
      />
      <TextArea
        id="emergencyProcedures"
        name="emergencyProcedures"
        label={t('subPacket.emergencyProcedures')}
        defaultValue={sent.text('emergencyProcedures', notes.emergencyProcedures)}
        error={errors?.emergencyProcedures}
      />
      <TextArea
        id="additionalNotes"
        name="additionalNotes"
        label={t('subPacket.additionalNotes')}
        defaultValue={sent.text('additionalNotes', notes.additionalNotes)}
        error={errors?.additionalNotes}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          name="includeAccommodations"
          defaultChecked={sent.checked('includeAccommodations', notes.includeAccommodations)}
        />{' '}
        {t('subPacket.includeAccommodations')}
      </label>
      <Submit label={t('subPacket.save')} />
    </form>
  );
}

/** Sends the presentation to a Classroom course as a Google Slides deck students view. */
export function PresentationClassroomForm(props: {
  readonly locale: Locale;
  readonly presentationId: string;
  readonly name: string;
  readonly courses: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(sendPresentationToClassroomAction, initial);
  const errors = state.errors ?? {};
  const sent = prefill(state.values);
  return (
    <form
      action={action}
      className="stack"
      aria-label={t('presentations.classroomSend')}
      key={`${String(state.version ?? 0)}-${sent.key}`}
    >
      <Hidden values={{ locale: props.locale, presentationId: props.presentationId }} />
      <FormAlert message={errors.form} />
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {state.scheduledFor === undefined
            ? t('presentations.classroomSent')
            : t('schedule.scheduledFor', { when: state.scheduledFor })}{' '}
          <a href={state.url}>{t('presentations.classroomOpen')}</a>
          {state.slidesUrl === undefined ? null : (
            <>
              {' · '}
              <a href={state.slidesUrl}>{t('presentations.classroomOpenSlides')}</a>
            </>
          )}
        </p>
      )}
      <Select
        id="slides-post-course"
        name="courseId"
        label={t('classroom.course')}
        options={props.courses}
        defaultValue={sent.text('courseId')}
        error={errors.courseId}
      />
      <Field
        id="slides-post-title"
        name="title"
        label={t('presentations.classroomName')}
        defaultValue={sent.text('title', props.name)}
        error={errors.title}
        required
      />
      <TextArea
        id="slides-post-instructions"
        name="instructions"
        label={t('presentations.classroomInstructions')}
        defaultValue={sent.text('instructions')}
        error={errors.instructions}
      />
      <Field
        id="slides-post-due"
        name="dueDate"
        type="date"
        label={t('presentations.classroomDueDate')}
        defaultValue={sent.text('dueDate')}
        error={errors.dueDate}
      />
      <ScheduleFields
        locale={props.locale}
        idPrefix="slides-post"
        error={errors.scheduledAt}
        sent={sent}
      />
      <p className="hint">{t('presentations.classroomNote')}</p>
      <Submit label={t('presentations.classroomSend')} />
    </form>
  );
}
