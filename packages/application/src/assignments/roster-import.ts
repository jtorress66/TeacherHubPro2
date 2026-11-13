import { createStudent, type Class, type Student, type StudentId } from '@thp/domain';
import type { IdGenerator, StudentRepository } from '@thp/ports';

/** A student from another service's roster: first and last name only. */
export interface ImportedName {
  readonly firstName: string;
  readonly lastName: string;
}

/** The same person by name: first and last name together, ignoring case. */
export const sameName = (a: ImportedName, b: ImportedName) =>
  `${a.firstName} ${a.lastName}`.trim().toLowerCase() ===
  `${b.firstName} ${b.lastName}`.trim().toLowerCase();

/**
 * Adds the names to the class roster (first and last name only), skipping names already there
 * and names repeated in the import.
 */
export async function addToRoster(
  deps: { readonly students: StudentRepository; readonly ids: IdGenerator },
  cls: Class,
  people: readonly ImportedName[],
): Promise<{ added: number; skipped: number }> {
  const current = await deps.students.listByClass(cls.schoolId, cls.id);
  const added: Student[] = [];
  for (const person of people) {
    if (current.some((s) => sameName(s, person)) || added.some((s) => sameName(s, person)))
      continue;
    const student = createStudent({
      id: deps.ids.next() as StudentId,
      schoolId: cls.schoolId,
      classId: cls.id,
      firstName: person.firstName,
      lastName: person.lastName,
    });
    if (student.ok) added.push(student.value);
  }
  await deps.students.saveMany(added);
  return { added: added.length, skipped: people.length - added.length };
}
