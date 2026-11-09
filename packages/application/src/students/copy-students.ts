import {
  createStudent,
  invalid,
  ok,
  type ClassId,
  type Result,
  type Student,
  type StudentId,
  type User,
} from '@thp/domain';
import type { ClassRepository, IdGenerator, StudentRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';

export interface CopyStudentsDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly ids: IdGenerator;
}

const nameKey = (student: Student) =>
  `${student.firstName}\u0000${student.lastName}`.toLocaleLowerCase();

/**
 * Fills a class's roster from another of the teacher's classes. Only the students' details are
 * copied, as new roster students; grades, attendance and links stay with the old class. A student
 * already in the class (same student number or, without one, same name) is skipped.
 */
export class CopyStudents {
  constructor(private readonly deps: CopyStudentsDeps) {}

  async execute(input: {
    actor: User;
    fromClassId: ClassId;
    toClassId: ClassId;
  }): Promise<Result<{ copied: number; skipped: number }, UseCaseError>> {
    if (input.fromClassId === input.toClassId) return invalid('fromClassId', 'not_allowed');
    const to = await findManagedClass(this.deps.classes, input.actor, input.toClassId);
    if (!to.ok) return to;
    const from = await findManagedClass(this.deps.classes, input.actor, input.fromClassId);
    if (!from.ok) return from;
    if (to.value.archivedAt !== null) return fail('class_archived');

    const { schoolId } = to.value;
    const existing = await this.deps.students.listByClass(schoolId, to.value.id);
    const numbers = new Set(existing.flatMap((student) => student.studentNumber ?? []));
    const names = new Set(existing.map(nameKey));
    const source = await this.deps.students.listByClass(schoolId, from.value.id);
    const copies: Student[] = [];
    for (const student of source) {
      const taken =
        student.studentNumber === null
          ? names.has(nameKey(student))
          : numbers.has(student.studentNumber);
      if (taken) continue;
      const copy = createStudent({
        ...student,
        id: this.deps.ids.next() as StudentId,
        classId: to.value.id,
      });
      if (!copy.ok) continue;
      copies.push(copy.value);
      names.add(nameKey(copy.value));
      if (copy.value.studentNumber !== null) numbers.add(copy.value.studentNumber);
    }
    await this.deps.students.saveMany(copies);
    return ok({ copied: copies.length, skipped: source.length - copies.length });
  }
}
