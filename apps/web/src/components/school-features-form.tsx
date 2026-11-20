'use client';

import { useActionState } from 'react';
import type { SchoolFeatures } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  setSchoolFeaturesAction,
  type SchoolFeaturesState,
} from '../app/_lib/school-overview-actions.ts';
import { FormAlert, Submit } from './forms.tsx';

const initial: SchoolFeaturesState = {};

/** The school-wide switches: AI drafting, and student flags and insights. */
export function SchoolFeaturesForm(props: {
  readonly locale: Locale;
  readonly features: SchoolFeatures;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(setSchoolFeaturesAction, initial);
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="locale" value={props.locale} />
      <FormAlert message={state.errors?.form} />
      <div className="field">
        <label className="checkbox">
          <input type="checkbox" name="ai" defaultChecked={props.features.ai} />{' '}
          {t('schoolOverview.ai')}
        </label>
        <p className="hint">{t('schoolOverview.aiHint')}</p>
      </div>
      <div className="field">
        <label className="checkbox">
          <input type="checkbox" name="studentFlags" defaultChecked={props.features.studentFlags} />{' '}
          {t('schoolOverview.studentFlags')}
        </label>
        <p className="hint">{t('schoolOverview.studentFlagsHint')}</p>
      </div>
      {state.saved ? (
        <p role="status" className="notice">
          {t('schoolOverview.saved')}
        </p>
      ) : null}
      <div>
        <Submit label={t('schoolOverview.save')} />
      </div>
    </form>
  );
}
