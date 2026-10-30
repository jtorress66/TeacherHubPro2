import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  GradeId,
  ReportCardCommentId,
  SchoolId,
  StudentId,
} from '@thp/domain';
import type {
  AssignmentRepository,
  GradeRepository,
  ReportCardCommentRepository,
  ReportCardPage,
  ReportCardRenderer,
} from '@thp/ports';
import { aGrade, anAssignment, aReportCardComment } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const classId = 'class-1' as ClassId;

/** Uses assignments `a1` and `assignment-1`, and students `student-1` and `student-one`. */
export function gradebookGradeContract(name: string, make: () => GradeRepository): void {
  describe(`${name} (GradeRepository gradebook reads)`, () => {
    const grade = (id: string, studentId: string, assignmentId: string) =>
      aGrade({
        id: id as GradeId,
        schoolId: schoolA,
        studentId: studentId as StudentId,
        assignmentId: assignmentId as AssignmentId,
      });
    const sorted = (grades: readonly { id: string }[]) => grades.map((g) => g.id).sort();

    it('lists the grades of several assignments at once, within the school', async () => {
      const repository = make();
      await repository.save(grade('g1', 'student-1', 'a1'));
      await repository.save(grade('g2', 'student-one', 'a1'));
      await repository.save(grade('g3', 'student-1', 'assignment-1'));

      expect(
        sorted(
          await repository.listByAssignments(schoolA, [
            'a1' as AssignmentId,
            'assignment-1' as AssignmentId,
          ]),
        ),
      ).toEqual(['g1', 'g2', 'g3']);
      expect(sorted(await repository.listByAssignments(schoolA, ['a1' as AssignmentId]))).toEqual([
        'g1',
        'g2',
      ]);
      expect(await repository.listByAssignments(schoolA, [])).toEqual([]);
      expect(await repository.listByAssignments(schoolB, ['a1' as AssignmentId])).toEqual([]);
    });

    it("deletes an assignment's grades, never another school's", async () => {
      const repository = make();
      await repository.save(grade('g1', 'student-1', 'a1'));
      await repository.save(grade('g3', 'student-1', 'assignment-1'));

      await repository.deleteByAssignment(schoolB, 'a1' as AssignmentId);
      expect(await repository.listByAssignment(schoolA, 'a1' as AssignmentId)).toHaveLength(1);

      await repository.deleteByAssignment(schoolA, 'a1' as AssignmentId);
      expect(await repository.listByAssignment(schoolA, 'a1' as AssignmentId)).toEqual([]);
      expect(sorted(await repository.listByStudent(schoolA, 'student-1' as StudentId))).toEqual([
        'g3',
      ]);
    });
  });
}

/** Uses category `category-1`. */
export function assignmentLookupContract(name: string, make: () => AssignmentRepository): void {
  describe(`${name} (AssignmentRepository lookups)`, () => {
    it('counts the assignments in a category, within the school', async () => {
      const repository = make();
      const category = 'category-1' as GradeCategoryId;
      await repository.save(anAssignment({ id: 'x1' as AssignmentId, schoolId: schoolA }));
      await repository.save(anAssignment({ id: 'x2' as AssignmentId, schoolId: schoolA }));

      expect(await repository.countByCategory(schoolA, category)).toBe(2);
      expect(await repository.countByCategory(schoolA, 'category-9' as GradeCategoryId)).toBe(0);
      expect(await repository.countByCategory(schoolB, category)).toBe(0);
    });
  });
}

/** Uses class `class-1`, students `student-1` and `student-one`, and teacher `teacher-1`. */
export function reportCardCommentContract(
  name: string,
  make: () => ReportCardCommentRepository,
): void {
  describe(`${name} (ReportCardCommentRepository contract)`, () => {
    const comment = (id: string, studentId: string, text: string) =>
      aReportCardComment({
        id: id as ReportCardCommentId,
        schoolId: schoolA,
        studentId: studentId as StudentId,
        text,
      });

    it('keeps one comment per student and class: saving another replaces it', async () => {
      const repository = make();
      await repository.save(comment('c1', 'student-1', 'First'));
      await repository.save(comment('c2', 'student-1', 'Second'));
      await repository.save(comment('c3', 'student-one', 'Other'));

      expect((await repository.findFor(schoolA, classId, 'student-1' as StudentId))?.text).toBe(
        'Second',
      );
      expect((await repository.listByClass(schoolA, classId)).map((c) => c.text).sort()).toEqual([
        'Other',
        'Second',
      ]);
    });

    it("deletes a student's comment and never reaches another school's", async () => {
      const repository = make();
      await repository.save(comment('c1', 'student-1', 'First'));

      expect(await repository.findFor(schoolB, classId, 'student-1' as StudentId)).toBeNull();
      expect(await repository.listByClass(schoolB, classId)).toEqual([]);
      await repository.deleteFor(schoolB, classId, 'student-1' as StudentId);
      expect(await repository.findFor(schoolA, classId, 'student-1' as StudentId)).not.toBeNull();

      await repository.deleteFor(schoolA, classId, 'student-1' as StudentId);
      expect(await repository.findFor(schoolA, classId, 'student-1' as StudentId)).toBeNull();
    });
  });
}

const page = (student: string): ReportCardPage => ({
  schoolName: 'Escuela Luz',
  schoolDetails: 'Calle Sol 1 · 555-0100',
  logo: null,
  title: 'Report card',
  sections: [
    { kind: 'facts', items: [{ label: 'Student', value: student }] },
    {
      kind: 'table',
      title: 'Grades',
      headers: ['Category', 'Points', '%', 'Letter'],
      rows: [['Tests', '45 / 50', '90.0%', 'A']],
      empty: 'No grades yet',
    },
    { kind: 'table', title: 'Attendance', headers: ['Present'], rows: [], empty: 'No days' },
    { kind: 'text', title: 'Comments', text: 'Great effort.' },
    { kind: 'signatures', labels: ['Teacher', 'Principal', 'Parent'] },
  ],
});

/** Counts page objects in an uncompressed PDF. */
export const pdfPageCount = (bytes: Uint8Array): number =>
  (new TextDecoder('latin1').decode(bytes).match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

export function reportCardRendererContract(name: string, make: () => ReportCardRenderer): void {
  describe(`${name} (ReportCardRenderer contract)`, () => {
    it('makes a PDF with one page per report card', async () => {
      const bytes = await make().render([page('Ana Ruiz'), page('Ben Soto'), page('Cruz Peña')]);

      expect(new TextDecoder('latin1').decode(bytes.slice(0, 5))).toBe('%PDF-');
      expect(pdfPageCount(bytes)).toBe(3);
    });

    it('prints accented and non-Latin names without failing', async () => {
      const bytes = await make().render([page('Ñandú Muñoz-Pérez'), page('Nguyễn 王小明')]);

      expect(pdfPageCount(bytes)).toBe(2);
    });
  });
}
