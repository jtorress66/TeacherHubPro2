export type RecommendationKind = 'attendance' | 'intervention' | 'grading' | 'planning';
export type Priority = 'high' | 'medium' | 'low';

/** A next step for the teacher; its words come from the message catalog. */
export interface Recommendation {
  readonly kind: RecommendationKind;
  readonly priority: Priority;
  readonly count: number;
}

export interface DayFacts {
  /** Classes meeting today without submitted attendance. */
  readonly attendanceToTake: number;
  /** At-risk students with a score of 4 or more. */
  readonly highRisk: number;
  /** Past-due assignments still to grade. */
  readonly overdueGrading: number;
  /** Classes without a lesson plan in the next seven days. */
  readonly classesWithoutPlans: number;
}

/** The rules, most urgent first; a new suggestion is a new entry. */
const rules: readonly {
  readonly kind: RecommendationKind;
  readonly priority: Priority;
  readonly count: (facts: DayFacts) => number;
}[] = [
  { kind: 'attendance', priority: 'high', count: (facts) => facts.attendanceToTake },
  { kind: 'intervention', priority: 'high', count: (facts) => facts.highRisk },
  { kind: 'grading', priority: 'medium', count: (facts) => facts.overdueGrading },
  { kind: 'planning', priority: 'low', count: (facts) => facts.classesWithoutPlans },
];

/** What to do next, from the day's facts. */
export const recommendations = (facts: DayFacts): Recommendation[] =>
  rules.flatMap(({ kind, priority, count }) => {
    const n = count(facts);
    return n > 0 ? [{ kind, priority, count: n }] : [];
  });
