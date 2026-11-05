import { describe, expect, it } from 'vitest';
import type { SchoolId, StudentId, StudentNote, StudentNoteId, UserId } from '@thp/domain';
import type { StudentInsightRepository, StudentNoteRepository } from '@thp/ports';

export interface Student360Repositories {
  readonly notes: StudentNoteRepository;
  readonly insights: StudentInsightRepository;
}

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const student = 'student-1' as StudentId;
const author = 'teacher-1' as UserId;
const colleague = 'teacher-2' as UserId;

const note = (id: string, authorId: UserId, at: string): StudentNote => ({
  id: id as StudentNoteId,
  schoolId: schoolA,
  studentId: student,
  authorId,
  text: `Note ${id}`,
  createdAt: new Date(at),
});

/**
 * Shared suites for Student 360's repositories. Fixtures use student-1, teacher-1 and teacher-2 in
 * school-a, so Postgres tests seed those parents.
 */
export function student360RepositoryContract(
  name: string,
  make: () => Student360Repositories,
): void {
  describe(`${name} (StudentNoteRepository)`, () => {
    it("lists the author's notes newest first, never a colleague's or another school's", async () => {
      const repo = make().notes;
      const older = note('n1', author, '2026-11-01T12:00:00Z');
      const newer = note('n2', author, '2026-11-03T12:00:00Z');
      await repo.save(older);
      await repo.save(newer);
      await repo.save(note('n3', colleague, '2026-11-02T12:00:00Z'));

      expect(await repo.listFor(schoolA, student, author)).toEqual([newer, older]);
      expect(await repo.listFor(schoolB, student, author)).toEqual([]);
    });

    it('deletes only an author’s own note in the school', async () => {
      const repo = make().notes;
      await repo.save(note('n1', author, '2026-11-01T12:00:00Z'));

      expect(await repo.delete(schoolA, 'n1' as StudentNoteId, colleague)).toBe(false);
      expect(await repo.delete(schoolB, 'n1' as StudentNoteId, author)).toBe(false);
      expect(await repo.delete(schoolA, 'n1' as StudentNoteId, author)).toBe(true);
      expect(await repo.listFor(schoolA, student, author)).toEqual([]);
    });
  });

  describe(`${name} (StudentInsightRepository)`, () => {
    it('keeps the latest insight per teacher and student, within the school', async () => {
      const repo = make().insights;
      const first = {
        schoolId: schoolA,
        studentId: student,
        teacherId: author,
        bullets: ['One', 'Two', 'Three'],
        generatedAt: new Date('2026-11-01T12:00:00Z'),
      };
      await repo.save(first);
      const second = {
        ...first,
        bullets: ['Four', 'Five', 'Six'],
        generatedAt: new Date('2026-11-02T12:00:00Z'),
      };
      await repo.save(second);

      expect(await repo.find(schoolA, student, author)).toEqual(second);
      expect(await repo.find(schoolA, student, colleague)).toBeNull();
      expect(await repo.find(schoolB, student, author)).toBeNull();
    });
  });
}
