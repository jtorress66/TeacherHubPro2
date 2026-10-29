import { parseOptionalEmail, type Email } from '../shared/email.ts';
import type { SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { optionalHttpsUrl } from '../shared/url.ts';
import { optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export interface School {
  readonly id: SchoolId;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  readonly email: Email | null;
  readonly logoUrl: string | null;
}

export interface SchoolInput {
  readonly id: SchoolId;
  readonly name: string;
  readonly address?: string | null;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly logoUrl?: string | null;
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
  const logoUrl = optionalHttpsUrl('logoUrl', input.logoUrl);
  if (!logoUrl.ok) return logoUrl;

  return ok({
    id: input.id,
    name: name.value,
    address: address.value,
    phone: phone.value,
    email: email.value,
    logoUrl: logoUrl.value,
  });
}

export type SchoolDetails = Omit<SchoolInput, 'id'>;

/** Replaces the school's details, with the same rules as creating one. The logo is kept unless given. */
export function updateSchoolDetails(
  school: School,
  details: SchoolDetails,
): Result<School, ValidationError> {
  return createSchool({
    logoUrl: school.logoUrl,
    ...details,
    id: school.id,
  });
}
