import type { LessonPlan, PlanFormat } from '@thp/domain';
import { ClassicPlan } from './classic.tsx';
import { SimplePlan } from './simple.tsx';
import type { PlanLayout } from './types.ts';

export type { PlanPrintProps } from './types.ts';

/** Each school format's print layout; a school's own format is one more entry. */
const layouts: Readonly<Record<PlanFormat, PlanLayout>> = {
  classic: ClassicPlan,
  simple: SimplePlan,
};

/** The school's layout for weekly plans; Conversational English plans print simply. */
export const planLayout = (format: PlanFormat, plan: LessonPlan): PlanLayout =>
  plan.body.kind === 'weekly' ? layouts[format] : SimplePlan;
