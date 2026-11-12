import { parseEmail, type Email } from '../shared/email.ts';
import type { SchoolId, UserId } from '../shared/ids.ts';
import { defaultLanguage, isLanguage, type Language } from '../shared/language.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalHttpsUrl } from '../shared/url.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import type { Role } from './roles.ts';

export const onboardingStatuses = ['not_started', 'in_progress', 'completed', 'dismissed'] as const;

export type OnboardingStatus = (typeof onboardingStatuses)[number];

export interface User {
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly email: Email;
  readonly name: string;
  readonly role: Role;
  readonly language: Language;
  readonly picture: string | null;
  readonly onboardingStatus: OnboardingStatus;
  /** When the person confirmed their email address; null until then. */
  readonly emailConfirmedAt: Date | null;
  /** When a super admin suspended the account; null while it is in good standing. */
  readonly suspendedAt: Date | null;
}

export interface UserInput {
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly email: string;
  readonly name: string;
  readonly role?: Role;
  readonly language?: string;
  readonly picture?: string | null;
  readonly onboardingStatus?: OnboardingStatus;
  readonly emailConfirmedAt?: Date | null;
  readonly suspendedAt?: Date | null;
}

export function createUser(input: UserInput): Result<User, ValidationError> {
  const email = parseEmail('email', input.email);
  if (!email.ok) return email;
  const name = requiredText('name', input.name);
  if (!name.ok) return name;
  const language = input.language ?? defaultLanguage;
  if (!isLanguage(language)) return invalid('language', 'invalid_format');
  const picture = optionalHttpsUrl('picture', input.picture);
  if (!picture.ok) return picture;

  return ok({
    id: input.id,
    schoolId: input.schoolId,
    email: email.value,
    name: name.value,
    role: input.role ?? 'teacher',
    language,
    picture: picture.value,
    onboardingStatus: input.onboardingStatus ?? 'not_started',
    emailConfirmedAt: input.emailConfirmedAt ?? null,
    suspendedAt: input.suspendedAt ?? null,
  });
}

export interface ProfileChanges {
  readonly name: string;
  readonly language: string;
  readonly picture?: string | null;
}

/** The fields a user may change about themselves; role and school are not among them. */
export function updateProfile(user: User, changes: ProfileChanges): Result<User, ValidationError> {
  return createUser({
    ...user,
    name: changes.name,
    language: changes.language,
    picture: changes.picture === undefined ? user.picture : changes.picture,
  });
}

/** A new user's first saved settings start their onboarding; later states are kept. */
export const markOnboardingStarted = (user: User): User =>
  user.onboardingStatus === 'not_started' ? { ...user, onboardingStatus: 'in_progress' } : user;

/** Super admins are trusted with the AI tools without confirming; everyone else confirms once. */
export const hasConfirmedEmail = (user: Pick<User, 'role' | 'emailConfirmedAt'>): boolean =>
  user.role === 'super_admin' || user.emailConfirmedAt !== null;

/** Marks the email confirmed; the first confirmation time is kept. */
export const confirmEmail = (user: User, now: Date): User =>
  user.emailConfirmedAt === null ? { ...user, emailConfirmedAt: now } : user;

export const suspend = (user: User, now: Date): User => ({ ...user, suspendedAt: now });

export const reinstate = (user: User): User => ({ ...user, suspendedAt: null });

/** Why a suspension is refused. */
export interface SuspensionRefusal {
  readonly code: 'forbidden' | 'own_account';
}

/** Only a super admin suspends, never themselves, and never another super admin. */
export function checkSuspension(
  actor: Pick<User, 'id' | 'role'>,
  target: Pick<User, 'id' | 'role'>,
): Result<true, SuspensionRefusal> {
  if (actor.role !== 'super_admin') return { ok: false, error: { code: 'forbidden' } };
  if (actor.id === target.id) return { ok: false, error: { code: 'own_account' } };
  if (target.role === 'super_admin') return { ok: false, error: { code: 'forbidden' } };
  return ok(true);
}
