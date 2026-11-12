/** How far back the super admin's user list counts each account's AI drafts. */
export const aiUsageWindowDays = 30;

/** About five AI drafts a day, every day: far beyond a teacher's normal week of planning. */
export const heavyAiUseThreshold = 150;

export const aiUsageSince = (now: Date): Date =>
  new Date(now.getTime() - aiUsageWindowDays * 24 * 60 * 60 * 1000);

/** True when an account's AI drafts in the window reach the threshold. */
export const isHeavyAiUse = (drafts: number): boolean => drafts >= heavyAiUseThreshold;
