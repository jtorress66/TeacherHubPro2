'use client';

import { useActionState } from 'react';
import { assistantSubjects, gradeLevels, lessonCountRange } from '@thp/domain';
import { createTranslator, localeInfo, locales, type Locale } from '@thp/i18n';
import {
  requestLearningPathsAction,
  type LearningFormState,
} from '../../app/_lib/learning-actions.ts';
import { Field, FormAlert, Submit } from '../forms.tsx';
import { EslSwitch, Hidden, Select, type Option } from '../form-fields.tsx';

const initial: LearningFormState = {};
const option = (id: string, name: string): Option => ({ id, name });

/** Asks the AI for a path for one student, or one for each student of the class. */
export function DraftPathForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly students: readonly Option[];
  readonly grade: string | null;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestLearningPathsAction, initial);
  const errors = state.errors;
  const grade = gradeLevels.find((g) => g === props.grade) ?? '4';
  return (
    <form action={action} className="stack" noValidate aria-label={t('learning.draftTitle')}>
      <Hidden values={{ locale: props.locale, classId: props.classId }} />
      <FormAlert message={errors?.form ?? errors?.studentId ?? errors?.lessonCount} />
      <div className="field-row">
        <Select
          id="learning-student"
          name="studentId"
          label={t('learning.student')}
          options={[option('', t('learning.wholeClass')), ...props.students]}
          defaultValue=""
        />
        <Select
          id="learning-subject"
          name="subject"
          label={t('learning.subject')}
          options={assistantSubjects.map((s) => option(s, t(`assistant.subject_${s}`)))}
          defaultValue="math"
          error={errors?.subject}
        />
        <Select
          id="learning-grade"
          name="grade"
          label={t('learning.grade')}
          options={gradeLevels.map((g) => option(g, g === 'K' ? t('drafts.grade_K') : g))}
          defaultValue={grade}
          error={errors?.grade}
        />
      </div>
      <Field
        id="learning-topic"
        name="topic"
        label={t('learning.topic')}
        hint={t('learning.topicHint')}
        error={errors?.topic}
      />
      <div className="field-row">
        <Field
          id="learning-lessons"
          name="lessonCount"
          type="number"
          min={lessonCountRange.min}
          label={t('learning.lessonCount')}
          defaultValue={lessonCountRange.default}
        />
        <Select
          id="learning-language"
          name="language"
          label={t('learning.language')}
          options={locales.map((l) => option(l, localeInfo[l].nativeName))}
          defaultValue={props.locale}
        />
      </div>
      <EslSwitch label={t('esl.label')} help={t('esl.learningHelp')} />
      <Submit label={t('learning.draft')} />
    </form>
  );
}
