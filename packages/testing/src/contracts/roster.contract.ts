import { describe, expect, it } from 'vitest';
import {
  archiveClass,
  type ClassId,
  type SchoolId,
  type SemesterId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import type { ClassRepository, SemesterRepository, StudentRepository } from '@thp/ports';
import { aClass, aSemester, aStudent } from '../fixtures.ts';

/**
 * Class and roster contracts. They use teacher `teacher-1`, classes `class-1` and `class-2` and
 * semester `semester-1` of school `school-a`; a database-backed run must create those first.
 */
const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher = 'teacher-1' as UserId;
const semesterId = 'semester-1' as SemesterId;
const archivedAt = new Date('2026-10-01T00:00:00.000Z');

const cls = (id: string, overrides: Parameters<typeof aClass>[0] = {}) =>
  aClass({ id: id as ClassId, schoolId: schoolA, teacherId: teacher, ...overrides });

export function classRepositoryContract(name: string, make: () => ClassRepository): void {
  describe(`${name} (ClassRepository contract)`, () => {
    it('leaves archived classes out of lists unless asked for', async () => {
      const classes = make();
      const archived = archiveClass(cls('archived'), archivedAt);
      await classes.save(cls('active'));
      await classes.save(archived);

      expect((await classes.listByTeacher(schoolA, teacher)).map((c) => c.id)).toEqual(['active']);
      expect(
        (await classes.listByTeacher(schoolA, teacher, { includeArchived: true }))
          .map((c) => c.id)
          .sort(),
      ).toEqual(['active', 'archived']);
      expect(await classes.findById(schoolA, archived.id)).toEqual(archived);
    });

    it("lists every class of a school for its admins, never another school's", async () => {
      const classes = make();
      await classes.save(cls('a1'));
      await classes.save(cls('a2', { teacherId: 'teacher-2' as UserId }));
      await classes.save(aClass({ id: 'b1' as ClassId, schoolId: schoolB }));

      expect((await classes.listBySchool(schoolA)).map((c) => c.id).sort()).toEqual(['a1', 'a2']);
    });

    it('counts the classes of a semester within the school', async () => {
      const classes = make();
      await classes.save(cls('a1', { semesterId }));
      await classes.save(cls('a2', { semesterId }));
      await classes.save(cls('a3'));

      expect(await classes.countBySemester(schoolA, semesterId)).toBe(2);
      expect(await classes.countBySemester(schoolB, semesterId)).toBe(0);
    });
  });
}

const student = (id: string, number: string | null, classId = 'class-1') =>
  aStudent({
    id: id as StudentId,
    schoolId: schoolA,
    classId: classId as ClassId,
    studentNumber: number,
  });

export function studentRepositoryContract(name: string, make: () => StudentRepository): void {
  describe(`${name} (StudentRepository contract)`, () => {
    it('saves many students at once', async () => {
      const students = make();
      await students.saveMany([student('s1', 'A1'), student('s2', 'A2'), student('s3', null)]);

      expect(
        (await students.listByClass(schoolA, 'class-1' as ClassId)).map((s) => s.id).sort(),
      ).toEqual(['s1', 's2', 's3']);
    });

    it('saves all or nothing: a repeated student number in the class refuses the whole batch', async () => {
      const students = make();
      await students.save(student('s1', 'A1'));

      await expect(students.saveMany([student('s2', 'B2'), student('s3', 'A1')])).rejects.toThrow();
      expect((await students.listByClass(schoolA, 'class-1' as ClassId)).map((s) => s.id)).toEqual([
        's1',
      ]);
    });

    it('allows the same student number in another class, and many students without a number', async () => {
      const students = make();
      await students.saveMany([student('s1', 'A1'), student('s2', null), student('s3', null)]);
      await students.save(student('s4', 'A1', 'class-2'));

      expect(await students.listByClass(schoolA, 'class-2' as ClassId)).toHaveLength(1);
    });
  });
}

export function semesterRepositoryContract(name: string, make: () => SemesterRepository): void {
  describe(`${name} (SemesterRepository contract)`, () => {
    const semester = (id: string, isActive: boolean, schoolId = schoolA) =>
      aSemester({ id: id as SemesterId, schoolId, isActive });

    it('refuses a second active semester in the same school', async () => {
      const semesters = make();
      await semesters.save(semester('s1', true));

      await expect(semesters.save(semester('s2', true))).rejects.toThrow();
      await semesters.save(semester('s1', false));
      await semesters.save(semester('s2', true));
      expect(
        (await semesters.listBySchool(schoolA)).filter((s) => s.isActive).map((s) => s.id),
      ).toEqual(['s2']);
    });

    it('lets each school have its own active semester', async () => {
      const semesters = make();
      await semesters.save(semester('a', true));
      await semesters.save(semester('b', true, schoolB));

      expect(await semesters.listBySchool(schoolB)).toHaveLength(1);
    });
  });
}
