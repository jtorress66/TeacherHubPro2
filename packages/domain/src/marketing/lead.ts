import { parseEmail, type Email } from '../shared/email.ts';
import type { LeadId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';

export const leadSources = ['chat', 'contact'] as const;
export type LeadSource = (typeof leadSources)[number];

export const leadScores = ['high', 'medium', 'low'] as const;
export type LeadScore = (typeof leadScores)[number];

export const leadStatuses = ['new', 'contacted', 'closed'] as const;
export type LeadStatus = (typeof leadStatuses)[number];

/** Who the visitor says they are, as the chatbot and contact form offer it. */
export const visitorRoles = [
  'teacher',
  'homeschool',
  'tutor',
  'school_admin',
  'principal',
  'district',
  'parent',
  'other',
] as const;

/** What they came for. */
export const visitorInterests = [
  'features',
  'pricing',
  'demo',
  'school',
  'enterprise',
  'support',
  'other',
] as const;

/** A prospective customer from the chatbot or the contact form, for the team to follow up. */
export interface Lead {
  readonly id: LeadId;
  readonly name: string;
  readonly email: Email;
  readonly organization: string | null;
  readonly role: string;
  readonly phone: string | null;
  readonly interest: string;
  readonly source: LeadSource;
  readonly message: string | null;
  readonly locale: string;
  /** The page they were on. */
  readonly page: string | null;
  readonly score: LeadScore;
  readonly status: LeadStatus;
  readonly createdAt: Date;
}

export interface LeadInput {
  readonly id: LeadId;
  readonly name: string;
  readonly email: string;
  readonly organization: string | null;
  readonly role: string;
  readonly phone: string | null;
  readonly interest: string;
  readonly source: LeadSource;
  readonly message: string | null;
  readonly locale: string;
  readonly page: string | null;
  readonly now: Date;
}

const highRoles: readonly string[] = ['district', 'school_admin', 'principal'];
const highInterests: readonly string[] = ['demo', 'enterprise'];
const mediumInterests: readonly string[] = ['pricing', 'school'];

/** High: schools and districts deciding; medium: likely buyers; low: everyone else. */
export function scoreLead(lead: {
  readonly role: string;
  readonly interest: string;
  readonly email: string | null;
}): LeadScore {
  if (highRoles.includes(lead.role) || highInterests.includes(lead.interest)) return 'high';
  if (mediumInterests.includes(lead.interest) || lead.email !== null) return 'medium';
  return 'low';
}

const short = 200;

export function createLead(input: LeadInput): Result<Lead, ValidationError> {
  const name = requiredText('name', input.name, short);
  if (!name.ok) return name;
  const email = parseEmail('email', input.email);
  if (!email.ok) return email;
  const organization = optionalText('organization', input.organization, short);
  if (!organization.ok) return organization;
  const role = requiredText('role', input.role, 40);
  if (!role.ok) return role;
  const phone = optionalText('phone', input.phone, 40);
  if (!phone.ok) return phone;
  const interest = requiredText('interest', input.interest, 40);
  if (!interest.ok) return interest;
  if (!(leadSources as readonly string[]).includes(input.source)) {
    return invalid('source', 'not_allowed');
  }
  const message = optionalText('message', input.message, 2000);
  if (!message.ok) return message;
  const page = optionalText('page', input.page, 300);
  if (!page.ok) return page;
  return ok({
    id: input.id,
    name: name.value,
    email: email.value,
    organization: organization.value,
    role: role.value,
    phone: phone.value,
    interest: interest.value,
    source: input.source,
    message: message.value,
    locale: input.locale,
    page: page.value,
    score: scoreLead({ role: role.value, interest: interest.value, email: email.value }),
    status: 'new',
    createdAt: input.now,
  });
}
