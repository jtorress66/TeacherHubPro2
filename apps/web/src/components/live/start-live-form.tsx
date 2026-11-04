'use client';

import { useActionState } from 'react';
import { questionSecondsRange } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { startLiveSessionAction, type LiveFormState } from '../../app/_lib/live-actions.ts';
import { Field, FormAlert, Submit } from '../forms.tsx';
import { Hidden, Select, type Option } from '../form-fields.tsx';

const initial: LiveFormState = {};

/** Starts a live or self-paced session of one of the teacher's games for one of their classes. */
export function StartLiveForm(props: {
  readonly locale: Locale;
  readonly games: readonly Option[];
  readonly classes: readonly Option[];
  readonly gameId?: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(startLiveSessionAction, initial);
  const errors = state.errors;
  return (
    <form action={action} className="stack" noValidate aria-label={t('live.startTitle')}>
      <Hidden values={{ locale: props.locale }} />
      <FormAlert message={errors?.form ?? errors?.mode ?? errors?.kind} />
      <div className="field-row">
        <Select
          id="live-game"
          name="gameId"
          label={t('live.game')}
          options={props.games}
          defaultValue={props.gameId ?? props.games[0]?.id}
        />
        <Select
          id="live-class"
          name="classId"
          label={t('live.class')}
          options={props.classes}
          defaultValue={props.classes[0]?.id}
        />
      </div>
      <fieldset className="checks">
        <legend>{t('live.kind')}</legend>
        {(['live', 'self_paced'] as const).map((kind) => (
          <label key={kind} className="checkbox">
            <input type="radio" name="kind" value={kind} defaultChecked={kind === 'live'} />{' '}
            {t(`live.kind_${kind}`)}
          </label>
        ))}
      </fieldset>
      <Field
        id="live-seconds"
        name="questionSeconds"
        type="number"
        min={questionSecondsRange.min}
        label={t('live.seconds')}
        defaultValue={questionSecondsRange.default}
        error={errors?.questionSeconds}
      />
      <Submit label={t('live.start')} />
    </form>
  );
}
