import { commonCoreRows } from './common-core-codes.ts';

export const standardSubjects = ['math', 'ela', 'science', 'social_studies'] as const;

export type StandardSubject = (typeof standardSubjects)[number];

export const gradeLevels = [
  'K',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
] as const;

export type GradeLevel = (typeof gradeLevels)[number];

/** One row of the generated catalog: code, subject, grades, description. */
export type StandardRow = readonly [string, StandardSubject, readonly GradeLevel[], string];

export interface Standard {
  readonly code: string;
  readonly subject: StandardSubject;
  readonly grades: readonly GradeLevel[];
  readonly description: string;
}

const catalog: readonly Standard[] = commonCoreRows.map(([code, subject, grades, description]) => ({
  code,
  subject,
  grades,
  description,
}));

const byCode = new Map(catalog.map((standard) => [standard.code, standard]));

export const isGradeLevel = (value: string): value is GradeLevel =>
  (gradeLevels as readonly string[]).includes(value);

/** An official Common Core standard, or null for any code not in the imported list. */
export const findStandard = (code: string): Standard | null => byCode.get(code) ?? null;

export const standardsFor = (subject: StandardSubject, grade: GradeLevel): readonly Standard[] =>
  catalog.filter((s) => s.subject === subject && s.grades.includes(grade));
