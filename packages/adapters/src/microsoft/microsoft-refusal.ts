import type { MicrosoftError } from '@thp/ports';

/**
 * AADSTS90094 (AdminConsentRequired) and AADSTS90095 (AdminConsentRequiredRequestAccess): the
 * school's administrator must approve the app before a teacher can.
 */
const adminApproval = /\bAADSTS(90094|90095)\b/u;
/**
 * AADSTS70011 (InvalidScope): a permission the account cannot have, as the Teams (Edu)
 * permissions for a personal Microsoft account.
 */
const invalidScope = /\bAADSTS70011\b/u;

/**
 * What the identity platform's refusal (sent back instead of a code, as `error` and
 * `error_description`) means for the teacher: ask the school's administrator, use a school
 * account, or grant it (or try) again.
 */
export function microsoftRefusal(response: {
  readonly error: string;
  readonly description: string | null;
}): MicrosoftError {
  const description = response.description ?? '';
  if (adminApproval.test(description)) return { code: 'admin_approval_required' };
  if (response.error === 'invalid_scope' || invalidScope.test(description)) {
    return { code: 'school_account_required' };
  }
  const declined = ['access_denied', 'consent_required', 'interaction_required'];
  return { code: declined.includes(response.error) ? 'declined' : 'unavailable' };
}
