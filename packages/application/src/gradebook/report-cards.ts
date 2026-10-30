import {
  classAttendanceReport,
  classGradeReport,
  ok,
  writeReportCardComment,
  type AttendanceSummary,
  type CategoryResult,
  type Class,
  type ClassId,
  type GradeCategory,
  type ReportCardComment,
  type ReportCardCommentId,
  type Result,
  type School,
  type Semester,
  type Student,
  type StudentGradeSummary,
  type StudentId,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  FileStore,
  GradeCategoryRepository,
  GradeRepository,
  IdGenerator,
  ReportCardCommentRepository,
  SchoolRepository,
  SemesterRepository,
  StoredFile,
  StudentRepository,
  UserRepository,
} from '@thp/ports';
import { findManagedClass } from '../classes/managed-class.ts';
import { fail, type UseCaseError } from '../errors.ts';
import { byName } from '../students/roster-order.ts';
import { classAssignments } from './assignments.ts';
import { findEditableClass, type ClassInput } from './gradebook-access.ts';

export interface ReportCardCategory {
  readonly category: GradeCategory;
  readonly result: CategoryResult;
}

export interface ReportCardAttendance {
  readonly summary: AttendanceSummary;
  readonly rate: number | null;
  readonly days: number;
}

export interface ReportCard {
  readonly student: Student;
  readonly categories: readonly ReportCardCategory[];
  readonly summary: StudentGradeSummary;
  readonly attendance: ReportCardAttendance;
  readonly comment: string | null;
}

export interface ReportCards {
  readonly school: School;
  readonly logo: StoredFile | null;
  readonly cls: Class;
  readonly semester: Semester | null;
  readonly teacher: User | null;
  readonly cards: readonly ReportCard[];
}

export interface ReportCardDeps {
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly reportCardComments: ReportCardCommentRepository;
  readonly semesters: SemesterRepository;
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly files: FileStore;
}

/** The school's logo bytes, or null when it has none (or the store cannot give them). */
async function schoolLogo(files: FileStore, school: School): Promise<StoredFile | null> {
  if (school.logoKey === null) return null;
  const file = await files.get(school.logoKey);
  return file.ok ? file.value : null;
}

/** The students asked for (all, in name order, by default); each must be in the class. */
async function chosenStudents(
  students: StudentRepository,
  cls: Class,
  studentIds: readonly StudentId[] | undefined,
): Promise<Result<Student[], UseCaseError>> {
  const roster = [...(await students.listByClass(cls.schoolId, cls.id))].sort(byName);
  if (studentIds === undefined) return ok(roster);
  const wanted = new Set(studentIds);
  const chosen = roster.filter((student) => wanted.has(student.id));
  return chosen.length === wanted.size ? ok(chosen) : fail('not_found');
}

/**
 * Report cards for a class's students: teacher-confirmed grades by category with the weighted
 * overall and GPA, attendance over the class's semester (every submitted day without one), and
 * the teacher's comment.
 */
export class GetReportCards {
  constructor(private readonly deps: ReportCardDeps) {}

  async execute(
    input: ClassInput & { studentIds?: readonly StudentId[] },
  ): Promise<Result<ReportCards, UseCaseError>> {
    const found = await findManagedClass(this.deps.classes, input.actor, input.classId);
    if (!found.ok) return found;
    const cls = found.value;
    const students = await chosenStudents(this.deps.students, cls, input.studentIds);
    if (!students.ok) return students;
    const school = await this.deps.schools.findById(cls.schoolId);
    if (!school) return fail('not_found');

    const semester =
      cls.semesterId === null
        ? null
        : await this.deps.semesters.findById(cls.schoolId, cls.semesterId);
    const range = semester ? { from: semester.startDate, to: semester.endDate } : undefined;
    const ids = students.value.map((student) => student.id);
    const categories = await this.deps.gradeCategories.listByClass(cls.schoolId, cls.id);
    const assignments = await classAssignments(this.deps.assignments, cls);
    const grades = await this.deps.grades.listByAssignments(
      cls.schoolId,
      assignments.map((a) => a.id),
    );
    const sessions = await this.deps.attendanceSessions.listByClass(cls.schoolId, cls.id, range);
    const comments = await this.deps.reportCardComments.listByClass(cls.schoolId, cls.id);

    const gradeRows = new Map(
      classGradeReport(categories, assignments, grades, ids).students.map((row) => [
        row.studentId,
        row.summary,
      ]),
    );
    const attendance = new Map(
      classAttendanceReport(sessions, ids, range).students.map((row) => [row.studentId, row]),
    );
    const days = sessions.filter((session) => session.status === 'submitted').length;
    const commentOf = new Map(comments.map((c) => [c.studentId, c.text]));
    const categoryOf = new Map(categories.map((c) => [c.id, c]));

    const cards = students.value.flatMap((student) => {
      const summary = gradeRows.get(student.id);
      const present = attendance.get(student.id);
      if (!summary || !present) return [];
      return [
        {
          student,
          summary,
          categories: summary.categories.flatMap((result) => {
            const category = categoryOf.get(result.categoryId);
            return category ? [{ category, result }] : [];
          }),
          attendance: { summary: present.summary, rate: present.rate, days },
          comment: commentOf.get(student.id) ?? null,
        },
      ];
    });

    return ok({
      school,
      logo: await schoolLogo(this.deps.files, school),
      cls,
      semester,
      teacher: await this.deps.users.findById(cls.schoolId, cls.teacherId),
      cards,
    });
  }
}

/** Saves the teacher's report card comment for a student; a blank comment removes it. */
export class SaveReportCardComment {
  constructor(
    private readonly deps: {
      readonly classes: ClassRepository;
      readonly students: StudentRepository;
      readonly reportCardComments: ReportCardCommentRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    actor: User;
    classId: ClassId;
    studentId: StudentId;
    text: string;
  }): Promise<Result<ReportCardComment | null, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const { schoolId, id: classId } = cls.value;
    const student = await this.deps.students.findById(schoolId, input.studentId);
    if (student?.classId !== classId) return fail('not_found');

    const existing = await this.deps.reportCardComments.findFor(schoolId, classId, student.id);
    const comment = writeReportCardComment({
      id: existing?.id ?? (this.deps.ids.next() as ReportCardCommentId),
      schoolId,
      classId,
      studentId: student.id,
      text: input.text,
      writtenBy: input.actor.id,
    });
    if (!comment.ok) return comment;
    if (comment.value === null) {
      await this.deps.reportCardComments.deleteFor(schoolId, classId, student.id);
    } else {
      await this.deps.reportCardComments.save(comment.value);
    }
    return comment;
  }
}
