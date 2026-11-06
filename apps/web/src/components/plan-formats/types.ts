import type { ReactNode } from 'react';
import type { Class, LessonPlan, School } from '@thp/domain';
import type { Locale } from '@thp/i18n';

/** What every print layout gets: the plan, its school and its class (if any). */
export interface PlanPrintProps {
  readonly locale: Locale;
  readonly plan: LessonPlan;
  readonly school: School;
  readonly cls: Class | null;
}

export type PlanLayout = (props: PlanPrintProps) => ReactNode;
