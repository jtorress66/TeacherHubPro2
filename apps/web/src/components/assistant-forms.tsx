'use client';

import { useActionState, useState } from 'react';
import {
  assistantSubjects,
  contentMinutesRange,
  contentTypes,
  gradeLevels,
  presentationThemes,
  questionCountRange,
  slideCountRange,
  type SubPacket,
} from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  createPresentationAction,
  requestGenerationAction,
  requestPresentationDraftAction,
  saveSubPacketAction,
  type AssistantFormState,
} from '../app/_lib/assistant-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, TextArea, type Option } from './form-fields.tsx';

const initial: AssistantFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

function SubjectAndGrade(props: {
  readonly locale: Locale;
  readonly errors: AssistantFormState['errors'];
}) {
  const t = createTranslator(props.locale);
  return (
    <>
      <Select
        id="subject"
        name="subject"
        label={t('assistant.subject')}
        options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
        defaultValue="math"
        error={props.errors?.subject}
      />
      <Select
        id="grade"
        name="grade"
        label={t('assistant.grade')}
        options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
        defaultValue="4"
        error={props.errors?.grade}
      />
    </>
  );
}

function LanguageSelect({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <Select
      id="language"
      name="language"
      label={t('assistant.language')}
      options={locales.map((l) => option(l, localeInfo[l].nativeName))}
      defaultValue={locale}
    />
  );
}

/** What the teacher asks the assistant to write. */
export function ContentForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(requestGenerationAction, initial);
  const errors = state.errors;
  return (
    <form action={action} className="stack" noValidate aria-label={t('assistant.title')}>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        <Select
          id="type"
          name="type"
          label={t('assistant.type')}
          options={contentTypes.map((type) => option(type, t(`assistant.type_${type}`)))}
          defaultValue="worksheet"
          error={errors?.type}
        />
        <SubjectAndGrade locale={locale} errors={errors} />
      </div>
      <Field id="topic" name="topic" label={t('assistant.topic')} error={errors?.topic} required />
      <div className="field-row">
        <Select
          id="difficulty"
          name="difficulty"
          label={t('assistant.difficulty')}
          options={(['easy', 'medium', 'hard'] as const).map((d) =>
            option(d, t(`drafts.difficulty_${d}`)),
          )}
          defaultValue="medium"
        />
        <Field
          id="questionCount"
          name="questionCount"
          type="number"
          min={questionCountRange.min}
          label={t('assistant.questionCount')}
          defaultValue={questionCountRange.default}
          error={errors?.questionCount}
        />
        <Field
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          min={contentMinutesRange.min}
          label={t('assistant.duration')}
          defaultValue={contentMinutesRange.default}
          error={errors?.durationMinutes}
        />
        <LanguageSelect locale={locale} />
      </div>
      <TextArea
        id="instructions"
        name="instructions"
        label={t('assistant.instructions')}
        error={errors?.instructions}
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
  return (
    <form action={action} className="stack" noValidate aria-label={t('presentations.generate')}>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <Field id="topic" name="topic" label={t('assistant.topic')} error={errors?.topic} required />
      <div className="field-row">
        <SubjectAndGrade locale={locale} errors={errors} />
        <Field
          id="slideCount"
          name="slideCount"
          type="number"
          min={slideCountRange.min}
          label={t('presentations.slideCount')}
          defaultValue={slideCountRange.default}
          error={errors?.slideCount}
        />
        <ThemeSelect locale={locale} />
        <LanguageSelect locale={locale} />
      </div>
      <Submit label={t('presentations.draftSubmit')} />
    </form>
  );
}

function ThemeSelect({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <Select
      id="theme"
      name="theme"
      label={t('presentations.theme')}
      options={presentationThemes.map((theme) => option(theme, t(`presentations.theme_${theme}`)))}
      defaultValue="ocean"
    />
  );
}

/** Starts a blank presentation with a name and theme. */
export function NewPresentationForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(createPresentationAction, initial);
  const errors = state.errors;
  return (
    <form action={action} className="stack" noValidate aria-label={t('presentations.newBlank')}>
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      <div className="field-row">
        <Field
          id="name"
          name="name"
          label={t('presentations.name')}
          error={errors?.name}
          required
        />
        <ThemeSelect locale={locale} />
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
  return (
    <form action={action} className="stack" noValidate aria-label={t('subPacket.subNotes')}>
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
          defaultValue={notes.mainOfficeExt}
          error={errors?.mainOfficeExt}
        />
        <Field
          id="nurseExt"
          name="nurseExt"
          label={t('subPacket.nurseExt')}
          defaultValue={notes.nurseExt}
          error={errors?.nurseExt}
        />
      </div>
      <TextArea
        id="dailyRoutines"
        name="dailyRoutines"
        label={t('subPacket.dailyRoutines')}
        defaultValue={notes.dailyRoutines}
        error={errors?.dailyRoutines}
      />
      <TextArea
        id="emergencyProcedures"
        name="emergencyProcedures"
        label={t('subPacket.emergencyProcedures')}
        defaultValue={notes.emergencyProcedures}
        error={errors?.emergencyProcedures}
      />
      <TextArea
        id="additionalNotes"
        name="additionalNotes"
        label={t('subPacket.additionalNotes')}
        defaultValue={notes.additionalNotes}
        error={errors?.additionalNotes}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          name="includeAccommodations"
          defaultChecked={notes.includeAccommodations}
        />{' '}
        {t('subPacket.includeAccommodations')}
      </label>
      <Submit label={t('subPacket.save')} />
    </form>
  );
}
