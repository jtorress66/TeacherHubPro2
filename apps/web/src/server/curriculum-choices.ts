import type { CurriculumGuideEntry } from '@thp/application';

/** A school guide the AI can follow, as the request forms show it. School material only. */
export interface CurriculumChoice {
  readonly subject: string;
  readonly grade: string;
  readonly title: string;
}

/** The school's guides the AI can follow now: the ready ones. */
export const curriculumChoices = (
  guides: readonly CurriculumGuideEntry[],
): readonly CurriculumChoice[] =>
  guides
    .filter((guide) => guide.status === 'ready')
    .map(({ subject, grade, title }) => ({ subject, grade, title }));

/** The guide for a subject and grade, if the school has one. */
export const guideFor = (
  choices: readonly CurriculumChoice[],
  subject: string,
  grade: string,
): CurriculumChoice | undefined =>
  choices.find((choice) => choice.subject === subject && choice.grade === grade);
