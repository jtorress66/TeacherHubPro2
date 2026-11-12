/** How many tries an action allows in a window before it answers "too many tries". */
export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
}

const minute = 60_000;
const hour = 60 * minute;

export const rateRules = {
  /** Password guessing against one account. */
  logInEmail: { limit: 5, windowMs: 15 * minute },
  /** Many accounts tried from one address; teachers of one school share a network. */
  logInAddress: { limit: 50, windowMs: 15 * minute },
  signUp: { limit: 20, windowMs: hour },
  passwordReset: { limit: 5, windowMs: hour },
  /** "Confirm your email" resends, per account. */
  confirmEmailResend: { limit: 5, windowMs: 24 * hour },
  contact: { limit: 5, windowMs: hour },
  linkSubmit: { limit: 30, windowMs: hour },
  /** A whole class joins from one school network, so this is generous. */
  liveJoin: { limit: 300, windowMs: 15 * minute },
} as const satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof rateRules;
