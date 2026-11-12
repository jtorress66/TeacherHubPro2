import { ok, type Result } from '../shared/result.ts';
import { invalid, type ValidationError } from '../shared/validation.ts';

/** The part after the @, in lower case; empty when there is none. */
export const emailDomain = (email: string): string => {
  const at = email.lastIndexOf('@');
  return at < 0
    ? ''
    : email
        .slice(at + 1)
        .trim()
        .toLowerCase();
};

/** True for the domain itself and any of its subdomains, never for a look-alike. */
export const isWithinDomain = (domain: string, parent: string): boolean =>
  domain === parent || domain.endsWith(`.${parent}`);

/** True when the email's domain is one of the blocked domains or a subdomain of one. */
export const matchesBlockedDomain = (email: string, blocked: readonly string[]): boolean => {
  const domain = emailDomain(email);
  return blocked.some((parent) => isWithinDomain(domain, parent));
};

/**
 * Well-known services that hand out temporary inboxes. Only domains that exist for that purpose
 * are listed, so no real teacher's address is ever refused.
 */
export const throwawayEmailDomains: readonly string[] = [
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'burnermail.io',
  'discard.email',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'incognitomail.org',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailinator.net',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'mytemp.email',
  'sharklasers.com',
  'spam4.me',
  'spamgourmet.com',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'tempr.email',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
];

/** True for an address at a temporary-inbox service, or a subdomain of one. */
export const isThrowawayEmail = (email: string): boolean =>
  matchesBlockedDomain(email, throwawayEmailDomains);

const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

/**
 * A domain a super admin typed: trimmed, in lower case, without a leading @. It needs at least
 * two parts (like `example.org`) and no spaces or @ inside.
 */
export function parseBlockedDomain(input: string): Result<string, ValidationError> {
  const domain = input.trim().toLowerCase().replace(/^@/u, '').trim();
  if (domain === '') return invalid('domain', 'required');
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 || !labels.every((part) => label.test(part))) {
    return invalid('domain', 'invalid_format');
  }
  return ok(domain);
}
