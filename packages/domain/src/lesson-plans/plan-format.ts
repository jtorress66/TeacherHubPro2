/**
 * How a school's weekly plans print. Each format is a layout in the web app; a school's own
 * format is added as a new entry here and a new layout there.
 */
export const planFormats = ['classic', 'simple'] as const;

export type PlanFormat = (typeof planFormats)[number];

/** The two-week layout teachers used in the original app, with signature lines. */
export const defaultPlanFormat: PlanFormat = 'classic';

export const isPlanFormat = (value: string): value is PlanFormat =>
  (planFormats as readonly string[]).includes(value);
