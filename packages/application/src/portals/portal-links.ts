import {
  createPortalLink,
  isLanguage,
  isUsable,
  linkExpiry,
  ok,
  parseEmail,
  revokeLink,
  type Class,
  type ClassId,
  type Language,
  type PortalLink,
  type PortalLinkId,
  type Result,
  type Student,
  type StudentId,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  IdGenerator,
  Mailer,
  MailTemplates,
  PortalLinkRepository,
  RandomTokenGenerator,
  SchoolRepository,
  SemesterRepository,
  StudentRepository,
  TokenHasher,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';

interface PortalDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly portalLinks: PortalLinkRepository;
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** The configured site address: every link a family gets points here. */
  readonly appUrl: string;
}

interface StudentRef {
  readonly actor: User;
  readonly classId: ClassId;
  readonly studentId: StudentId;
}

/** A link just made: its full address is shown or emailed once and never stored. */
export interface IssuedPortalLink {
  readonly link: PortalLink;
  readonly student: Student;
  readonly url: string;
}

async function classStudent(
  deps: PortalDeps,
  input: StudentRef,
): Promise<Result<{ cls: Class; student: Student }, UseCaseError>> {
  const cls = await findManagedClass(deps.classes, input.actor, input.classId);
  if (!cls.ok) return cls;
  const student = await deps.students.findById(cls.value.schoolId, input.studentId);
  if (student?.classId !== cls.value.id) return fail('not_found');
  return ok({ cls: cls.value, student });
}

/** A new link for the student's family; their earlier links stop working. */
async function issue(
  deps: PortalDeps,
  cls: Class,
  student: Student,
  language: Language,
  sentTo: PortalLink['sentTo'],
): Promise<IssuedPortalLink> {
  const now = deps.clock.now();
  const earlier = await deps.portalLinks.listByClass(cls.schoolId, cls.id);
  for (const old of earlier.filter((l) => l.studentId === student.id && isUsable(l, now))) {
    await deps.portalLinks.save(revokeLink(old, now));
  }
  const semester =
    cls.semesterId === null ? null : await deps.semesters.findById(cls.schoolId, cls.semesterId);
  const token = deps.tokens.generate();
  const link = createPortalLink({
    id: deps.ids.next() as PortalLinkId,
    schoolId: cls.schoolId,
    classId: cls.id,
    studentId: student.id,
    tokenHash: await deps.tokenHasher.hash(token),
    sentTo,
    expiresAt: linkExpiry(semester?.endDate ?? null, now),
  });
  await deps.portalLinks.save(link);
  return { link, student, url: `${deps.appUrl}/${language}/p/${token}` };
}

/** A new family link to show the teacher once (to copy or print). */
export class IssuePortalLink {
  constructor(private readonly deps: PortalDeps) {}

  async execute(
    input: StudentRef & { readonly language?: string },
  ): Promise<Result<IssuedPortalLink, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const language = isLanguage(input.language) ? input.language : input.actor.language;
    return ok(await issue(this.deps, found.value.cls, found.value.student, language, null));
  }
}

/** Emails the family a new link, in their language, to the parent's address or another. */
export class EmailPortalLink {
  constructor(
    private readonly deps: PortalDeps & {
      readonly schools: SchoolRepository;
      readonly mailer: Mailer;
      readonly mailTemplates: MailTemplates;
    },
  ) {}

  async execute(
    input: StudentRef & { readonly to?: string; readonly language?: string },
  ): Promise<Result<IssuedPortalLink, UseCaseError>> {
    const found = await classStudent(this.deps, input);
    if (!found.ok) return found;
    const { cls, student } = found.value;
    const to = parseEmail('to', input.to ?? student.parentEmail ?? '');
    if (!to.ok) return to;
    const language = isLanguage(input.language) ? input.language : input.actor.language;
    const school = await this.deps.schools.findById(cls.schoolId);
    const issued = await issue(this.deps, cls, student, language, to.value);
    const sent = await this.deps.mailer.send({
      to: to.value,
      ...this.deps.mailTemplates.portalLink({
        language,
        firstName: student.firstName,
        schoolName: school?.name ?? '',
        className: cls.name,
        url: issued.url,
      }),
    });
    if (!sent.ok) {
      await this.deps.portalLinks.save(revokeLink(issued.link, this.deps.clock.now()));
      return fail('email_failed');
    }
    return ok(issued);
  }
}

export interface PortalLinkRow {
  readonly student: Student;
  readonly link: PortalLink | null;
  readonly usable: boolean;
}

/** Every student of the class with their family's current link (never its token). */
export class ListPortalLinks {
  constructor(private readonly deps: PortalDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
  }): Promise<Result<readonly PortalLinkRow[], UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const now = this.deps.clock.now();
    const links = await this.deps.portalLinks.listByClass(cls.value.schoolId, cls.value.id);
    const roster = await this.deps.students.listByClass(cls.value.schoolId, cls.value.id);
    return ok(
      [...roster].sort(byName).map((student) => {
        const mine = links.filter((l) => l.studentId === student.id);
        const link = mine.find((l) => isUsable(l, now)) ?? mine.at(-1) ?? null;
        return { student, link, usable: link !== null && isUsable(link, now) };
      }),
    );
  }
}

/** Stops a family link working at once. */
export class RevokePortalLink {
  constructor(private readonly deps: PortalDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
    readonly linkId: PortalLinkId;
  }): Promise<Result<true, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const link = await this.deps.portalLinks.findById(cls.value.schoolId, input.linkId);
    if (link?.classId !== cls.value.id) return fail('not_found');
    await this.deps.portalLinks.save(revokeLink(link, this.deps.clock.now()));
    return ok(true);
  }
}
