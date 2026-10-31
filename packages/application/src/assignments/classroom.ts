import {
  connectClassroom,
  createStudent,
  ok,
  type ClassId,
  type ClassroomConnection,
  type Result,
  type Student,
  type StudentId,
  type User,
} from '@thp/domain';
import type {
  AttachmentRepository,
  ClassroomAuthorization,
  ClassroomConnectionRepository,
  ClassroomCourse,
  ClassroomCourses,
  ClassroomCoursework,
  Clock,
  IdGenerator,
  SecretCipher,
  StudentRepository,
} from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import {
  editableAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';

interface ConnectionDeps {
  readonly classroomConnections: ClassroomConnectionRepository;
  readonly cipher: SecretCipher;
  readonly classroomAuth: ClassroomAuthorization;
}

/** A fresh access token from the teacher's stored (encrypted) refresh token. */
async function accessToken(
  deps: ConnectionDeps,
  actor: User,
): Promise<Result<string, UseCaseError>> {
  const connection = await deps.classroomConnections.find(actor.schoolId, actor.id);
  if (connection === null) return fail('classroom_not_connected');
  const refresh = await deps.cipher.decrypt(connection.encryptedRefreshToken);
  if (!refresh.ok) return fail('classroom_not_connected');
  const access = await deps.classroomAuth.accessToken(refresh.value);
  return access.ok ? access : fail('classroom_failed');
}

/** Where to send the teacher to grant Classroom access. */
export class StartClassroomConnect {
  constructor(private readonly deps: { readonly classroomAuth: ClassroomAuthorization }) {}

  execute(input: { readonly state: string; readonly redirectUri: string }): string {
    return this.deps.classroomAuth.authorizationUrl(input.state, input.redirectUri);
  }
}

/** Keeps the granted access, encrypted. */
export class FinishClassroomConnect {
  constructor(private readonly deps: ConnectionDeps & { readonly clock: Clock }) {}

  async execute(input: {
    readonly actor: User;
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<Result<ClassroomConnection, UseCaseError>> {
    const granted = await this.deps.classroomAuth.exchangeCode(input.code, input.redirectUri);
    if (!granted.ok) return fail('classroom_failed');
    const connection = connectClassroom({
      schoolId: input.actor.schoolId,
      teacherId: input.actor.id,
      encryptedRefreshToken: await this.deps.cipher.encrypt(granted.value.refreshToken),
      connectedAt: this.deps.clock.now(),
    });
    await this.deps.classroomConnections.save(connection);
    return ok(connection);
  }
}

export class DisconnectClassroom {
  constructor(
    private readonly deps: { readonly classroomConnections: ClassroomConnectionRepository },
  ) {}

  async execute(input: { readonly actor: User }): Promise<Result<true, UseCaseError>> {
    await this.deps.classroomConnections.delete(input.actor.schoolId, input.actor.id);
    return ok(true);
  }
}

export class ListClassroomCourses {
  constructor(
    private readonly deps: ConnectionDeps & { readonly classroomCourses: ClassroomCourses },
  ) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<readonly ClassroomCourse[], UseCaseError>> {
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const courses = await this.deps.classroomCourses.listCourses(token.value);
    return courses.ok ? courses : fail('classroom_failed');
  }
}

const sameName = (
  a: { firstName: string; lastName: string },
  b: { firstName: string; lastName: string },
) =>
  `${a.firstName} ${a.lastName}`.trim().toLowerCase() ===
  `${b.firstName} ${b.lastName}`.trim().toLowerCase();

/** Adds a Classroom course's students to a class, skipping names already on the roster. */
export class ImportClassroomRoster {
  constructor(
    private readonly deps: ConnectionDeps & {
      readonly classroomCourses: ClassroomCourses;
      readonly classes: AssignmentAccessDeps['classes'];
      readonly students: StudentRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
    readonly courseId: string;
  }): Promise<Result<{ added: number; skipped: number }, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const roster = await this.deps.classroomCourses.listRoster(token.value, input.courseId);
    if (!roster.ok) return fail('classroom_failed');
    const current = await this.deps.students.listByClass(cls.value.schoolId, cls.value.id);
    const added: Student[] = [];
    for (const person of roster.value) {
      if (current.some((s) => sameName(s, person)) || added.some((s) => sameName(s, person)))
        continue;
      const student = createStudent({
        id: this.deps.ids.next() as StudentId,
        schoolId: cls.value.schoolId,
        classId: cls.value.id,
        firstName: person.firstName,
        lastName: person.lastName,
      });
      if (student.ok) added.push(student.value);
    }
    await this.deps.students.saveMany(added);
    return ok({ added: added.length, skipped: roster.value.length - added.length });
  }
}

/**
 * Posts an assignment to a Classroom course (only one with questions or files). It links to the
 * app, never to a student's personal link: each student keeps their own.
 */
export class ShareAssignment {
  constructor(
    private readonly deps: ConnectionDeps &
      AssignmentAccessDeps & {
        readonly classroomCoursework: ClassroomCoursework;
        readonly attachments: AttachmentRepository;
        readonly appUrl: string;
      },
  ) {}

  async execute(
    input: AssignmentRef & { readonly courseId: string },
  ): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    const files = await this.deps.attachments.listByAssignment(assignment.schoolId, assignment.id);
    if (assignment.questions.length === 0 && files.length === 0) return fail('not_shareable');
    const token = await accessToken(this.deps, input.actor);
    if (!token.ok) return token;
    const shared = await this.deps.classroomCoursework.createCoursework(
      token.value,
      input.courseId,
      {
        title: assignment.title,
        description: assignment.instructions ?? '',
        link: this.deps.appUrl,
        dueDate: assignment.dueDate,
      },
    );
    return shared.ok ? ok({ url: shared.value.url }) : fail('classroom_failed');
  }
}
