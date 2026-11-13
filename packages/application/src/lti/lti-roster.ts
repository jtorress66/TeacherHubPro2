import {
  createStudent,
  learnersFrom,
  ok,
  type Class,
  type ClassId,
  type LtiCourse,
  type LtiLearner,
  type LtiPlatformId,
  type Result,
  type Student,
  type StudentId,
  type User,
} from '@thp/domain';
import type {
  ClassRepository,
  IdGenerator,
  LtiCourseRepository,
  LtiMembershipsClient,
  LtiPlatformRepository,
  LtiStudentLinkRepository,
  StudentRepository,
} from '@thp/ports';
import { sameName } from '../assignments/roster-import.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';

/** The courses the teacher has opened TeacherHubPro from, most recent first. */
export class ListLtiCourses {
  constructor(private readonly deps: { readonly ltiCourses: LtiCourseRepository }) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<readonly LtiCourse[], UseCaseError>> {
    return ok(await this.deps.ltiCourses.listForTeacher(input.actor.schoolId, input.actor.id));
  }
}

/** What an import did: students added, learners already on the list, and learners without a name. */
export interface LtiRosterImport {
  readonly added: number;
  readonly alreadyThere: number;
  readonly noName: number;
}

export interface ImportLtiRosterDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly ids: IdGenerator;
  readonly ltiPlatforms: LtiPlatformRepository;
  readonly ltiCourses: LtiCourseRepository;
  readonly ltiStudentLinks: LtiStudentLinkRepository;
  readonly ltiMemberships: LtiMembershipsClient;
}

/**
 * Adds a course's active learners to a class, when its teacher asks: first and last name only,
 * each linked to their course system id so a later import adds only newcomers. A learner whose name
 * is already on the roster (and not linked yet) is linked to that student. Nobody is ever removed.
 */
export class ImportLtiRoster {
  constructor(private readonly deps: ImportLtiRosterDeps) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
    readonly platformId: LtiPlatformId;
    readonly contextId: string;
  }): Promise<Result<LtiRosterImport, UseCaseError>> {
    const { actor } = input;
    const cls = await findEditableClass(this.deps.classes, actor, input.classId);
    if (!cls.ok) return cls;
    const course = await this.deps.ltiCourses.find(
      actor.schoolId,
      actor.id,
      input.platformId,
      input.contextId,
    );
    if (course === null) return fail('not_found');
    const platform = await this.deps.ltiPlatforms.findById(actor.schoolId, course.platformId);
    if (platform === null) return fail('not_found');
    if (course.membershipsUrl === null) return fail('course_system_refused');
    const members = await this.deps.ltiMemberships.listMembers(platform, course.membershipsUrl);
    if (!members.ok) {
      return fail(
        members.error === 'not_allowed' ? 'course_system_refused' : 'course_system_unavailable',
      );
    }
    const { learners, noName } = learnersFrom(members.value);
    const placed = await this.place(cls.value, platform.id, learners);
    return ok({ ...placed, noName });
  }

  /** Finds or adds each learner's student in the class, and links the ones not linked yet. */
  private async place(
    cls: Class,
    platformId: LtiPlatformId,
    learners: readonly LtiLearner[],
  ): Promise<{ readonly added: number; readonly alreadyThere: number }> {
    const { students, ltiStudentLinks } = this.deps;
    const roster = await students.listByClass(cls.schoolId, cls.id);
    const links = await ltiStudentLinks.listForClass(cls.schoolId, cls.id, platformId);
    const linked = new Set(links.map((link) => link.subject));
    const taken = new Set<StudentId>(links.map((link) => link.studentId));
    const added: Student[] = [];
    const newLinks: { readonly subject: string; readonly studentId: StudentId }[] = [];
    let alreadyThere = 0;
    for (const learner of learners) {
      if (linked.has(learner.subject)) {
        alreadyThere += 1;
        continue;
      }
      const student =
        roster.find((s) => !taken.has(s.id) && sameName(s, learner)) ??
        this.newStudent(cls, learner);
      if (student === null) continue;
      if (roster.includes(student)) alreadyThere += 1;
      else added.push(student);
      taken.add(student.id);
      newLinks.push({ subject: learner.subject, studentId: student.id });
    }
    await students.saveMany(added);
    for (const link of newLinks) {
      await ltiStudentLinks.link(cls.schoolId, platformId, link.subject, link.studentId);
    }
    return { added: added.length, alreadyThere };
  }

  private newStudent(cls: Class, learner: LtiLearner): Student | null {
    const student = createStudent({
      id: this.deps.ids.next() as StudentId,
      schoolId: cls.schoolId,
      classId: cls.id,
      firstName: learner.firstName,
      lastName: learner.lastName,
    });
    return student.ok ? student.value : null;
  }
}
