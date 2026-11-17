import type { SampleText } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';

const five = ['1', '2', '3', '4', '5'] as const;
const six = [...five, '6'] as const;

/** The sample class's words in the teacher's language. */
export function sampleText(locale: Locale): SampleText {
  const t = createTranslator(locale);
  return {
    className: t('sample.className'),
    subject: t('sample.subject'),
    students: six.map((n) => t(`sample.student${n}`)),
    categories: {
      homework: t('gradebook.standard_homework'),
      quiz: t('gradebook.standard_quiz'),
      test: t('gradebook.standard_test'),
      project: t('gradebook.standard_project'),
    },
    homework: t('sample.homework'),
    quiz: t('sample.quiz'),
    onlineQuiz: t('sample.onlineQuiz'),
    choicePrompt: t('sample.choicePrompt'),
    truePrompt: t('sample.truePrompt'),
    explainPrompt: t('sample.explainPrompt'),
    explainModel: t('sample.explainModel'),
    explainAnswer: t('sample.explainAnswer'),
    explainFeedback: t('sample.explainFeedback'),
    feedback: t('sample.feedback'),
    plan: {
      unit: t('sample.planUnit'),
      objective: t('sample.planObjective'),
      skills: [t('sample.skill1'), t('sample.skill2'), t('sample.skill3')],
      days: five.map((n) => [t(`sample.day${n}Theme`), t(`sample.day${n}Notes`)] as const),
    },
    game: {
      title: t('sample.gameTitle'),
      prompts: five.map((n) => t(`sample.game${n}`)),
    },
  };
}
