'use client';

import { useActionState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  cancelSchoolDeletionAction,
  requestSchoolDeletionAction,
  type SchoolDeletionState,
} from '../app/_lib/school-deletion-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';

const initial: SchoolDeletionState = {};

/** The typed confirmation: the school's name, then the button. */
export function DeleteSchoolForm(props: { readonly locale: Locale; readonly schoolName: string }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestSchoolDeletionAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={props.locale} />
      <FormAlert message={state.errors?.form} />
      <Field
        label={t('schoolDeletion.confirmLabel', { school: props.schoolName })}
        name="schoolName"
        id="delete-school-name"
        autoComplete="off"
        error={state.errors?.schoolName}
        required
      />
      <Submit label={t('schoolDeletion.button')} tone="danger" />
    </form>
  );
}

export function CancelSchoolDeletionForm(props: { readonly locale: Locale }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(cancelSchoolDeletionAction, initial);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="locale" value={props.locale} />
      <FormAlert message={state.errors?.form} />
      <Submit label={t('schoolDeletion.cancel')} />
    </form>
  );
}
