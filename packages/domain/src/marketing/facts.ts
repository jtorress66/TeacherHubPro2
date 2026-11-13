import { planCatalog, planIds, trialDays, type PlanId } from '../billing/plan-catalog.ts';

/**
 * What TeacherHubPro really does today. The marketing chatbot and pages state only these; a
 * feature is added here when it ships, never before.
 */
export const productFeatures = [
  'lesson_planner',
  'ai_assistant',
  'presentations',
  'read_aloud',
  'substitute_packets',
  'classes_and_rosters',
  'attendance',
  'gradebook_and_report_cards',
  'assignments_and_online_tests',
  'pdf_to_online_test',
  'ai_grading',
  'google_classroom',
  'educational_games',
  'live_games',
  'learning_paths',
  'family_portal',
  'command_center',
  'student_360',
  'prep_agent',
  'school_admin',
  'languages',
] as const;

export type ProductFeature = (typeof productFeatures)[number];

export interface PlanFact {
  readonly id: PlanId;
  /** US dollars for one unit per `per`. */
  readonly price: number;
  readonly unit: 'account' | 'teacher';
  readonly per: 'month' | 'year';
  readonly billedYearly: boolean;
  readonly minimumTeachers: number;
}

export interface ChatFacts {
  readonly trialDays: number;
  /** The trial needs no payment card. */
  readonly trialNeedsCard: false;
  readonly plans: readonly PlanFact[];
  readonly features: readonly ProductFeature[];
  /** Interface languages, every one fully translated. */
  readonly languages: readonly string[];
}

/** The product facts, from the plan catalog: the only prices anything may state. */
export const chatFacts = (): ChatFacts => ({
  trialDays,
  trialNeedsCard: false,
  plans: planIds.map((id) => {
    const plan = planCatalog[id];
    return {
      id,
      price: plan.priceCents / 100,
      unit: plan.unit,
      per: plan.pricePer,
      billedYearly: plan.billedEvery === 'year',
      minimumTeachers: plan.minimumSeats,
    };
  }),
  features: productFeatures,
  languages: ['English', 'Spanish', 'French', 'Portuguese', 'German', 'Italian', 'Chinese'],
});
