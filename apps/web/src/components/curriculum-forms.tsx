'use client';

import { useActionState, useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { assistantSubjects, gradeLevels } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  uploadCurriculumAction,
  type CurriculumFormState,
} from '../app/_lib/curriculum-actions.ts';
import { guideFor, type CurriculumChoice } from '../server/curriculum-choices.ts';
import { prefill } from '../server/form-values.ts';
import { ErrorText, Hidden, Select, TextArea, type Option } from './form-fields.tsx';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: CurriculumFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

/** Adds a guide for a subject and grade, from a PDF or Word file or from pasted text. */
export function CurriculumUploadForm({ locale }: { readonly locale: Locale }) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(uploadCurriculumAction, initial);
  const sent = prefill(state.values);
  const errors = state.errors;
  return (
    <form
      action={action}
      className="stack"
      noValidate
      aria-label={t('curriculum.addHeading')}
      key={`${String(state.version ?? 0)}-${sent.key}`}
    >
      <Hidden values={{ locale }} />
      <FormAlert message={errors?.form} />
      {state.saved === undefined ? null : (
        <p role="status" className="notice">
          {t(state.saved === 'reading' ? 'curriculum.reading' : 'curriculum.saved')}
        </p>
      )}
      <div className="field-row">
        <Select
          id="curriculum-subject"
          name="subject"
          label={t('curriculum.col_subject')}
          options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
          defaultValue={sent.text('subject', 'math')}
          error={errors?.subject}
        />
        <Select
          id="curriculum-grade"
          name="grade"
          label={t('curriculum.col_grade')}
          options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
          defaultValue={sent.text('grade', '4')}
          error={errors?.grade}
        />
      </div>
      <Field
        id="curriculum-title"
        name="title"
        label={t('curriculum.guideTitle')}
        defaultValue={sent.text('title')}
        error={errors?.title}
      />
      <div className="field">
        <label htmlFor="curriculum-file">{t('curriculum.file')}</label>
        <input
          id="curriculum-file"
          name="file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          aria-invalid={errors?.file ? true : undefined}
          aria-describedby={errors?.file ? 'curriculum-file-error' : 'curriculum-file-hint'}
        />
        {errors?.file ? null : (
          <p id="curriculum-file-hint" className="hint">
            {t('curriculum.fileHint')}
          </p>
        )}
        <ErrorText id="curriculum-file" message={errors?.file} />
      </div>
      <TextArea
        id="curriculum-text"
        name="text"
        label={t('curriculum.text')}
        rows={6}
        defaultValue={sent.text('text')}
        error={errors?.text}
      />
      <p className="hint">{t('curriculum.replaceHint')}</p>
      <p className="muted">{t('curriculum.privacy')}</p>
      <div>
        <Submit label={t('curriculum.upload')} />
      </div>
    </form>
  );
}

/** While a file is being read, shows the page again every few seconds until it is done. */
export function RefreshWhileReading({ intervalMs = 2000 }: { readonly intervalMs?: number }) {
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

/** The subject and grade chosen in the form around this element, as the teacher changes them. */
function useChosenSubjectAndGrade(
  ref: RefObject<HTMLElement | null>,
): { readonly subject: string; readonly grade: string } | null {
  const [chosen, setChosen] = useState<{ subject: string; grade: string } | null>(null);
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return undefined;
    const read = () => {
      const data = new FormData(form);
      const text = (name: string) => {
        const value = data.get(name);
        return typeof value === 'string' ? value : '';
      };
      const subject = text('subject');
      const grade = text('grade');
      setChosen((now) =>
        now?.subject === subject && now.grade === grade ? now : { subject, grade },
      );
    };
    read();
    form.addEventListener('change', read);
    // A form can also change its fields itself (another class picked), with no change event.
    const observer = new MutationObserver(read);
    observer.observe(form, { childList: true, subtree: true });
    return () => {
      form.removeEventListener('change', read);
      observer.disconnect();
    };
  }, [ref]);
  return chosen;
}

/**
 * "Follow our school's curriculum", on by default, with the guide the AI will follow for the
 * subject and grade chosen. Shown only when the school has a guide ready.
 */
export function CurriculumSwitch(props: {
  readonly locale: Locale;
  readonly choices: readonly CurriculumChoice[];
  readonly defaultChecked?: boolean;
}) {
  const t = createTranslator(props.locale);
  const ref = useRef<HTMLDivElement>(null);
  const chosen = useChosenSubjectAndGrade(ref);
  if (props.choices.length === 0) return null;
  const guide = chosen && guideFor(props.choices, chosen.subject, chosen.grade);
  return (
    <div className="curriculum-switch" ref={ref}>
      <label className="checkbox">
        <input
          type="checkbox"
          name="followCurriculum"
          aria-describedby="follow-curriculum-help"
          defaultChecked={props.defaultChecked ?? true}
        />{' '}
        {t('curriculum.follow')}
      </label>
      <p id="follow-curriculum-help" className="hint" aria-live="polite">
        {chosen === null
          ? null
          : guide
            ? t('curriculum.followUses', { title: guide.title })
            : t('curriculum.followNone')}
      </p>
    </div>
  );
}
