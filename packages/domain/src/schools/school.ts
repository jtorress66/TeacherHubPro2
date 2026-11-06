import { parseOptionalEmail, type Email } from '../shared/email.ts';
import { defaultPlanFormat, isPlanFormat, type PlanFormat } from '../lesson-plans/plan-format.ts';
import type { SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export interface School {
  readonly id: SchoolId;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: Email | null;
  /** Where the uploaded logo is kept in the file store; null when there is none. */
  readonly logoKey: string | null;
  /** How the school's weekly plans print. */
  readonly planFormat: PlanFormat;
}

export interface SchoolInput {
  readonly id: SchoolId;
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly logoKey?: string | null;
  readonly planFormat?: string;
}

export function createSchool(input: SchoolInput): Result<School, ValidationError> {
  const name = requiredText('name', input.name);
  if (!name.ok) return name;
  const address = optionalText('address', input.address);
  if (!address.ok) return address;
  const phone = optionalText('phone', input.phone, 40);
  if (!phone.ok) return phone;
  const email = parseOptionalEmail('email', input.email);
  if (!email.ok) return email;
  const planFormat = input.planFormat ?? defaultPlanFormat;
  if (!isPlanFormat(planFormat)) return invalid('planFormat', 'not_allowed');

  return ok({
    id: input.id,
    name: name.value,
    address: address.value,
    phone: phone.value,
    email: email.value,
    logoKey: input.logoKey ?? null,
    planFormat,
  });
}

export type SchoolDetails = Omit<SchoolInput, 'id' | 'logoKey'>;

/**
 * Replaces the school's details, with the same rules as creating one. The logo is kept, and so
 * is the plan format unless given.
 */
export function updateSchoolDetails(
  school: School,
  details: SchoolDetails,
): Result<School, ValidationError> {
  return createSchool({
    planFormat: school.planFormat,
    ...details,
    id: school.id,
    logoKey: school.logoKey,
  });
}

export const setSchoolLogo = (school: School, logoKey: string | null): School => ({
  ...school,
  logoKey,
});
