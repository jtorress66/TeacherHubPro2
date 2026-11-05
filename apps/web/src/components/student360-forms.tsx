'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  addStudentNoteAction,
  requestStudentInsightAction,
  type Student360FormState,
} from '../app/_lib/student360-actions.ts';
import { FormAlert, Submit } from './forms.tsx';
import { Hidden, TextArea } from './form-fields.tsx';

const initial: Student360FormState = {};

interface StudentProps {
  readonly locale: Locale;
  readonly classId: string;
  readonly studentId: string;
}

const hidden = (props: StudentProps) => ({
  locale: props.locale,
  classId: props.classId,
  studentId: props.studentId,
});

export function AddNoteForm(props: StudentProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(addStudentNoteAction, initial);
  return (
    <form
      action={action}
      className="stack"
      aria-label={t('student360.addNote')}
      key={state.version}
    >
      <Hidden values={hidden(props)} />
      <TextArea
        id="student-note"
        name="text"
        label={t('student360.note')}
        error={state.errors?.text}
      />
      <FormAlert message={state.errors?.form} />
      <Submit label={t('student360.addNote')} />
    </form>
  );
}

export function InsightForm(props: StudentProps & { readonly again: boolean }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestStudentInsightAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('student360.generate')}>
      <Hidden values={hidden(props)} />
      <FormAlert message={state.errors?.form} />
      <Submit label={props.again ? t('student360.regenerate') : t('student360.generate')} />
    </form>
  );
}
