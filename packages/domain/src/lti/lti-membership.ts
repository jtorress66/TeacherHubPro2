/** A learner on a course's class list: their course system id and name, nothing else. */
export interface LtiLearner {
  /** The course system's id for them (`user_id`, the `sub` of their launches). */
  readonly subject: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface LtiLearners {
  readonly learners: readonly LtiLearner[];
  /** Learners left out because the course system did not share a first and last name. */
  readonly noName: number;
}

/** A roster name holds at most this many characters. */
const maxNameLength = 100;
const lis = 'http://purl.imsglobal.org/vocab/lis/v2';
const learnerRoles: ReadonlySet<string> = new Set(['Learner', 'Student']);
const teacherRoles: ReadonlySet<string> = new Set(['Instructor', 'Administrator', 'Faculty']);

type Member = Readonly<Record<string, unknown>>;

const isMember = (value: unknown): value is Member =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';

/**
 * The principal role a role names, in any of the forms course systems send: `…/membership#Learner`,
 * a sub-role `…/membership/Instructor#TeachingAssistant`, `…/institution/person#Student`, LTI 1.1's
 * `urn:lti:role:ims/lis/Learner`, or the short `Learner`.
 */
function principal(role: string): string {
  for (const prefix of [`${lis}/membership#`, `${lis}/membership/`, `${lis}/institution/person#`]) {
    if (role.startsWith(prefix)) return role.slice(prefix.length).split('#')[0] ?? '';
  }
  const legacy = /^urn:lti:(?:role|instrole):ims\/lis\/(\w+)/u.exec(role);
  return legacy?.[1] ?? role;
}

/** A learner, and nothing more: anyone who also teaches, assists or administers is left out. */
function isLearner(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  const names = roles.filter((role) => typeof role === 'string').map(principal);
  return names.some((name) => learnerRoles.has(name)) && !names.some((n) => teacherRoles.has(n));
}

/** Members are active unless the course system says otherwise. */
const isActive = (status: unknown): boolean => status === undefined || status === 'Active';

/** First and last name; from the full name (first word, then the rest) when they are missing. */
function nameOf(member: Member): { readonly firstName: string; readonly lastName: string } {
  const given = text(member.given_name);
  const family = text(member.family_name);
  if (given !== '' && family !== '') return { firstName: given, lastName: family };
  const [first = '', ...rest] = text(member.name).split(' ');
  return { firstName: first, lastName: rest.join(' ') };
}

/**
 * The active learners of a Names and Role Provisioning class list, each once, with their first and
 * last name only (emails, pictures and the rest are never read). Learners without a full name are
 * counted, not added.
 */
export function learnersFrom(members: unknown): LtiLearners {
  if (!Array.isArray(members)) return { learners: [], noName: 0 };
  const seen = new Set<string>();
  const learners: LtiLearner[] = [];
  let noName = 0;
  for (const member of members) {
    if (!isMember(member) || !isLearner(member.roles) || !isActive(member.status)) continue;
    const subject = typeof member.user_id === 'string' ? member.user_id.trim() : '';
    if (subject === '' || seen.has(subject)) continue;
    seen.add(subject);
    const { firstName, lastName } = nameOf(member);
    if (firstName === '' || lastName === '') {
      noName += 1;
      continue;
    }
    learners.push({
      subject,
      firstName: firstName.slice(0, maxNameLength),
      lastName: lastName.slice(0, maxNameLength),
    });
  }
  return { learners, noName };
}
