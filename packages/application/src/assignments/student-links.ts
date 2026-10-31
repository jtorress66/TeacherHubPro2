import {
  createStudentLink,
  isUsable,
  linkExpiry,
  ok,
  revokeLink,
  type Class,
  type ClassId,
  type Result,
  type Student,
  type StudentId,
  type StudentLink,
  type StudentLinkId,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  Clock,
  IdGenerator,
  RandomTokenGenerator,
  SemesterRepository,
  StudentLinkRepository,
  StudentRepository,
  TokenHasher,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';

interface Deps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly studentLinks: StudentLinkRepository;
  readonly tokens: RandomTokenGenerator;
  readonly tokenHasher: TokenHasher;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

interface ClassRef {
  readonly actor: User;
  readonly classId: ClassId;
}

/** A link just made: the raw token is shown to the teacher once and never stored. */
export interface IssuedLink {
  readonly student: Student;
  readonly token: string;
}

const byName = (a: Student, b: Student) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

async function issue(deps: Deps, cls: Class, student: Student): Promise<IssuedLink> {
  const semester =
    cls.semesterId === null ? null : await deps.semesters.findById(cls.schoolId, cls.semesterId);
  const token = deps.tokens.generate();
  await deps.studentLinks.save(
    createStudentLink({
      id: deps.ids.next() as StudentLinkId,
      schoolId: cls.schoolId,
      classId: cls.id,
      studentId: student.id,
      tokenHash: await deps.tokenHasher.hash(token),
      expiresAt: linkExpiry(semester?.endDate ?? null, deps.clock.now()),
    }),
  );
  return { student, token };
}

/** Gives each student in the class without a working link a new one. */
export class IssueLinks {
  constructor(private readonly deps: Deps) {}

  async execute(input: ClassRef): Promise<Result<readonly IssuedLink[], UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const now = this.deps.clock.now();
    const links = await this.deps.studentLinks.listByClass(cls.value.schoolId, cls.value.id);
    const covered = new Set(links.filter((l) => isUsable(l, now)).map((l) => l.studentId));
    const roster = await this.deps.students.listByClass(cls.value.schoolId, cls.value.id);
    const issued: IssuedLink[] = [];
    for (const student of [...roster].sort(byName)) {
      if (!covered.has(student.id)) issued.push(await issue(this.deps, cls.value, student));
    }
    return ok(issued);
  }
}

/** Every student with their current link (never its token) and whether it still works. */
export class ListLinks {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: ClassRef,
  ): Promise<
    Result<readonly { student: Student; link: StudentLink | null; usable: boolean }[], UseCaseError>
  > {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const now = this.deps.clock.now();
    const links = await this.deps.studentLinks.listByClass(cls.value.schoolId, cls.value.id);
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

/** Stops a link working at once. */
export class RevokeLink {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: ClassRef & { readonly linkId: StudentLinkId },
  ): Promise<Result<true, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const link = await this.deps.studentLinks.findById(cls.value.schoolId, input.linkId);
    if (link?.classId !== cls.value.id) return fail('not_found');
    await this.deps.studentLinks.save(revokeLink(link, this.deps.clock.now()));
    return ok(true);
  }
}

/** A new link for one student (a lost or shared link); the old ones stop working. */
export class ReissueLink {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: ClassRef & { readonly studentId: StudentId },
  ): Promise<Result<IssuedLink, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const student = await this.deps.students.findById(cls.value.schoolId, input.studentId);
    if (student?.classId !== cls.value.id) return fail('not_found');
    const now = this.deps.clock.now();
    const links = await this.deps.studentLinks.listByClass(cls.value.schoolId, cls.value.id);
    for (const link of links.filter((l) => l.studentId === student.id && isUsable(l, now))) {
      await this.deps.studentLinks.save(revokeLink(link, now));
    }
    return ok(await issue(this.deps, cls.value, student));
  }
}
