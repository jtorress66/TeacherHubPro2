import {
  createSchool,
  createSemester,
  createUser,
  isLanguage,
  isValidQuantity,
  onboardingStatuses,
  parseEmail,
  planIds,
  startTrial,
  trialDays,
  type OnboardingStatus,
  type PlanId,
  type Role,
  type SchoolId,
  type SemesterId,
  type SubscriptionId,
  type SubscriptionStatus,
  type UserId,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { day, flag, instant, number, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper, type MigrationContext } from './migration-set.ts';

/** The old app's own default for a school nobody named. */
const unnamedSchool = 'My School';

export const schoolsMapper: LegacyMapper = {
  collection: 'schools',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'school_id');
      if (id === null) {
        tally.skipped('schools', 'missing_id');
        continue;
      }
      const email = text(doc, 'email');
      const emailOk = email === null || parseEmail('email', email).ok;
      if (!emailOk) tally.noted('schools', 'email_dropped');
      if (text(doc, 'logo_url') !== null) tally.noted('schools', 'logo_not_copied');
      const school = createSchool({
        id: id as SchoolId,
        name: text(doc, 'name') ?? unnamedSchool,
        address: text(doc, 'address'),
        phone: text(doc, 'phone'),
        email: emailOk ? email : null,
      });
      if (!school.ok) {
        tally.skipped('schools', invalidReason(school.error));
        continue;
      }
      set.schools.set(id, school.value);
      tally.imported('schools');
    }
  },
};

const oldRoles: Readonly<Record<string, Role>> = {
  teacher: 'teacher',
  admin: 'school_admin',
  school_admin: 'school_admin',
  super_admin: 'super_admin',
};

const onboarding = (value: string | null): OnboardingStatus =>
  (onboardingStatuses as readonly (string | null)[]).includes(value)
    ? (value as OnboardingStatus)
    : 'not_started';

/** An old personal school (the old app made one at each sign-up) belongs to just this user. */
const isPersonalSchool = (school: LegacyDocument | undefined, oldUserId: string): boolean =>
  school !== undefined &&
  (text(school, 'owner_user_id') === oldUserId ||
    text(school, 'school_id') === `school_${oldUserId.replace(/^user_/u, '')}`);

/** A user already in the new app (same email) keeps their account; their old data joins it. */
async function adoptExisting(
  { set, tally, existingUsers }: MigrationContext,
  doc: LegacyDocument,
  oldId: string,
  email: string,
  oldSchools: readonly LegacyDocument[],
): Promise<boolean> {
  const parsed = parseEmail('email', email);
  if (!parsed.ok) return false;
  const existing = await existingUsers.findByEmail(parsed.value);
  if (existing === null || existing.id === oldId) return false;
  set.aliasUser(oldId, existing);
  const oldSchoolId = text(doc, 'school_id');
  const oldSchool = oldSchools.find((school) => text(school, 'school_id') === oldSchoolId);
  if (oldSchoolId !== null && isPersonalSchool(oldSchool, oldId)) {
    set.schools.delete(oldSchoolId);
    set.aliasSchool(oldSchoolId, existing.schoolId);
    tally.noted('schools', 'merged_into_existing_account');
  }
  tally.noted('users', 'matched_existing_account');
  tally.imported('users');
  return true;
}

/**
 * Old users become users; their bcrypt password hash is kept so they log in with their old
 * password. Parents had no real accounts in the old app and are left out.
 */
export const usersMapper = (oldSchools: readonly LegacyDocument[]): LegacyMapper => ({
  collection: 'users',
  async map(docs, context) {
    const { set, tally } = context;
    const seenEmails = new Set<string>();
    for (const doc of docs) {
      const id = text(doc, 'user_id');
      const email = text(doc, 'email')?.toLowerCase() ?? null;
      if (id === null || email === null) {
        tally.skipped('users', id === null ? 'missing_id' : 'missing_email');
        continue;
      }
      if (seenEmails.has(email)) {
        tally.skipped('users', 'duplicate_email');
        continue;
      }
      seenEmails.add(email);
      if (await adoptExisting(context, doc, id, email, oldSchools)) continue;
      const role = oldRoles[text(doc, 'role') ?? 'teacher'];
      if (role === undefined) {
        tally.skipped('users', 'role_without_accounts');
        continue;
      }
      const schoolId = set.schoolId(text(doc, 'school_id'));
      if (schoolId === null) {
        tally.skipped('users', 'school_not_found');
        continue;
      }
      const language = text(doc, 'language');
      const picture = text(doc, 'picture');
      const user = createUser({
        id: id as UserId,
        schoolId,
        email,
        name: text(doc, 'name') ?? email,
        role,
        language: language !== null && isLanguage(language) ? language : 'es',
        picture: picture?.startsWith('https://') === true ? picture : null,
        onboardingStatus: onboarding(text(doc, 'onboarding_status')),
      });
      if (!user.ok) {
        tally.skipped('users', invalidReason(user.error));
        continue;
      }
      set.users.set(id, user.value);
      const signedUp = instant(doc, 'created_at');
      if (signedUp !== null) set.signedUp.set(user.value.id, signedUp);
      const hash = text(doc, 'password_hash');
      if (hash === null) tally.noted('users', 'no_password');
      else set.credentials.push({ userId: user.value.id, passwordHash: hash });
      tally.imported('users');
    }
  },
});

const isPlan = (value: string | null): value is PlanId =>
  (planIds as readonly (string | null)[]).includes(value);

const oldStatuses: Readonly<Record<string, SubscriptionStatus>> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  cancelled: 'canceled',
  expired: 'expired',
  trial_expired: 'expired',
};

const dayMs = 24 * 60 * 60 * 1000;

/**
 * The old app gave everyone without a subscription a free trial from sign-up. Someone still
 * inside it keeps it: a trial ending when the old one would have.
 */
function carryOverTrials({ set, tally, now }: MigrationContext): void {
  const owners = new Set([...set.subscriptions.values()].map((s) => s.ownerId));
  for (const user of set.users.values()) {
    const signedUp = set.signedUp.get(user.id);
    if (owners.has(user.id) || signedUp === undefined) continue;
    if (signedUp.getTime() + trialDays * dayMs <= now.getTime()) continue;
    const trial = startTrial({
      id: `trial_${user.id}` as SubscriptionId,
      schoolId: user.schoolId,
      ownerId: user.id,
      planId: 'individual_monthly',
      now: signedUp,
    });
    if (!trial.ok) continue;
    set.subscriptions.set(trial.value.id, trial.value);
    tally.noted('users', 'trial_carried_over');
  }
}

/** Each owner's subscription, with its payment provider id, so billing carries on. */
export const subscriptionsMapper: LegacyMapper = {
  collection: 'subscriptions',
  map(docs, context) {
    const { set, tally } = context;
    for (const doc of docs) {
      const id = text(doc, 'subscription_id') ?? text(doc, '_id');
      const owner = set.user(text(doc, 'user_id'));
      const planId = text(doc, 'plan_id');
      const status = oldStatuses[text(doc, 'status') ?? ''];
      const quantity = number(doc, 'quantity') ?? 1;
      if (id === null || owner === null) {
        tally.skipped('subscriptions', id === null ? 'missing_id' : 'owner_not_found');
        continue;
      }
      if (!isPlan(planId) || status === undefined) {
        tally.skipped('subscriptions', status === undefined ? 'unknown_status' : 'unknown_plan');
        continue;
      }
      if (!isValidQuantity(planId, quantity)) {
        tally.skipped('subscriptions', 'invalid_quantity');
        continue;
      }
      const created = instant(doc, 'created_at');
      const trialEnd =
        instant(doc, 'trial_end') ??
        (created === null ? null : new Date(created.getTime() + trialDays * dayMs));
      set.subscriptions.set(id, {
        id: id as SubscriptionId,
        schoolId: owner.schoolId,
        ownerId: owner.id,
        planId,
        quantity,
        status,
        trialEndsAt: trialEnd ?? instant(doc, 'current_period_start') ?? new Date(0),
        currentPeriodEnd: instant(doc, 'current_period_end'),
        externalId: text(doc, 'stripe_subscription_id'),
      });
      tally.imported('subscriptions');
    }
    carryOverTrials(context);
  },
};

export const semestersMapper: LegacyMapper = {
  collection: 'semesters',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'semester_id');
      const schoolId = set.schoolId(text(doc, 'school_id'));
      if (id === null || schoolId === null) {
        tally.skipped('semesters', id === null ? 'missing_id' : 'school_not_found');
        continue;
      }
      const semester = createSemester({
        id: id as SemesterId,
        schoolId,
        name: text(doc, 'name') ?? '',
        startDate: day(doc, 'start_date') ?? '',
        endDate: day(doc, 'end_date') ?? '',
        schoolYear: text(doc, 'year_term'),
        isActive: flag(doc, 'is_active'),
      });
      if (!semester.ok) {
        tally.skipped('semesters', invalidReason(semester.error));
        continue;
      }
      set.semesters.set(id, semester.value);
      tally.imported('semesters');
    }
  },
};
