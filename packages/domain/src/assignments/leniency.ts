import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';

/** How strictly open answers are graded for a grade level, as data (from the original app). */
export interface Leniency {
  readonly leniency: 'very_high' | 'high' | 'medium_high' | 'medium' | 'low';
  readonly focus: string;
  readonly spellingMatters: boolean;
}

const byGrade: Readonly<Record<GradeLevel, Leniency>> = {
  K: { leniency: 'very_high', focus: 'effort and participation', spellingMatters: false },
  '1': { leniency: 'very_high', focus: 'basic understanding', spellingMatters: false },
  '2': { leniency: 'high', focus: 'basic understanding', spellingMatters: false },
  '3': { leniency: 'high', focus: 'comprehension', spellingMatters: false },
  '4': { leniency: 'medium_high', focus: 'comprehension and expression', spellingMatters: true },
  '5': { leniency: 'medium_high', focus: 'comprehension and expression', spellingMatters: true },
  '6': { leniency: 'medium', focus: 'analysis and expression', spellingMatters: true },
  '7': { leniency: 'medium', focus: 'analysis and critical thinking', spellingMatters: true },
  '8': { leniency: 'medium', focus: 'analysis and critical thinking', spellingMatters: true },
  '9': { leniency: 'low', focus: 'argument and evidence', spellingMatters: true },
  '10': { leniency: 'low', focus: 'argument and evidence', spellingMatters: true },
  '11': { leniency: 'low', focus: 'depth, evidence and precision', spellingMatters: true },
  '12': { leniency: 'low', focus: 'depth, evidence and precision', spellingMatters: true },
};

/** The class's grade level decides; an unknown grade grades like grade 6. */
export const leniencyFor = (grade: string | null): Leniency =>
  byGrade[grade !== null && isGradeLevel(grade) ? grade : '6'];
