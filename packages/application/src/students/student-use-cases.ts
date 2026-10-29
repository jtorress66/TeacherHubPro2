import {
  createStudent,
  ok,
  updateStudent,
  type ClassId,
  type Result,
  type Student,
  type StudentChanges,
  type StudentId,
  type User,
} from '@thp/domain';
import type { ClassRepository, IdGenerator, StudentRepository } from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { byName } from './roster-order.ts';

interface RosterDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
}

/** True when another student in the class already has this number. */
async function numberTaken(students: StudentRepository, student: Student): Promise<boolean> {
  if (student.studentNumber === null) return false;
  const roster = await students.listByClass(student.schoolId, student.classId);
  return roster.some(
    (other) => other.id !== student.id && other.studentNumber === student.studentNumber,
  );
}

/** A student of the actor's school, in a class the actor manages. */
async function findManagedStudent(
  deps: RosterDeps,
  actor: User,
  studentId: StudentId,
): Promise<Result<Student, UseCaseError>> {
  const student = await deps.students.findById(actor.schoolId, studentId);
  if (!student) return fail('not_found');
  const cls = await findManagedClass(deps.classes, actor, student.classId);
  return cls.ok ? ok(student) : cls;
}

export class AddStudent {
  constructor(private readonly deps: RosterDeps & { readonly ids: IdGenerator }) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    details: StudentChanges;
  }): Promise<Result<Student, UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    if (cls.value.archivedAt !== null) return fail('class_archived');
    const student = createStudent({
      ...input.details,
      id: this.deps.ids.next() as StudentId,
      schoolId: cls.value.schoolId,
      classId: cls.value.id,
    });
    if (!student.ok) return student;
    if (await numberTaken(this.deps.students, student.value))
      return fail('duplicate_student_number');
    await this.deps.students.save(student.value);
    return ok(student.value);
  }
}

export class UpdateStudent {
  constructor(private readonly deps: RosterDeps) {}

  async execute(input: {
    actor: User;
    studentId: StudentId;
    details: StudentChanges;
  }): Promise<Result<Student, UseCaseError>> {
    const found = await findManagedStudent(this.deps, input.actor, input.studentId);
    if (!found.ok) return found;
    const updated = updateStudent(found.value, input.details);
    if (!updated.ok) return updated;
    if (await numberTaken(this.deps.students, updated.value))
      return fail('duplicate_student_number');
    await this.deps.students.save(updated.value);
    return ok(updated.value);
  }
}

export class DeleteStudent {
  constructor(private readonly deps: RosterDeps) {}

  async execute(input: { actor: User; studentId: StudentId }): Promise<Result<true, UseCaseError>> {
    const found = await findManagedStudent(this.deps, input.actor, input.studentId);
    if (!found.ok) return found;
    await this.deps.students.delete(found.value.schoolId, found.value.id);
    return ok(true);
  }
}

/** The class roster, by last name then first name. */
export class ListStudents {
  constructor(private readonly deps: RosterDeps) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
  }): Promise<Result<Student[], UseCaseError>> {
    const cls = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const roster = await this.deps.students.listByClass(cls.value.schoolId, cls.value.id);
    return ok([...roster].sort(byName));
  }
}
