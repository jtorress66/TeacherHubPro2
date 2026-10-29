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
