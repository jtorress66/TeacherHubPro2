import { parseOptionalEmail, type Email } from '../shared/email.ts';
import type { SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export interface School {
  readonly id: SchoolId;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: Email | null;
  /** Where the uploaded logo is kept in the file store; null when there is none. */
  readonly logoKey: string | null;
}

export interface SchoolInput {
  readonly id: SchoolId;
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly logoKey?: string | null;
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

  return ok({
    id: input.id,
    name: name.value,
    address: address.value,
    phone: phone.value,
    email: email.value,
    logoKey: input.logoKey ?? null,
  });
}

export type SchoolDetails = Omit<SchoolInput, 'id' | 'logoKey'>;

/** Replaces the school's details, with the same rules as creating one. The logo is kept unless given. */
export function updateSchoolDetails(
  school: School,
  details: SchoolDetails,
): Result<School, ValidationError> {
  return createSchool({
    ...details,
    id: school.id,
    logoKey: school.logoKey,
  });
}

export const setSchoolLogo = (school: School, logoKey: string | null): School => ({
  ...school,
  logoKey,
});
