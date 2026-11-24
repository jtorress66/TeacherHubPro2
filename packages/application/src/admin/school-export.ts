import {
  byCurriculumOrder,
  canExportSchoolData,
  ok,
  type AssistantSubject,
  type Assignment,
  type AttendanceStatus,
  type AuditEventId,
  type Class,
  type GradeLevel,
  type GradeStatus,
  type Language,
  type LocalDate,
  type Result,
  type Role,
  type Student,
  type User,
} from '@thp/domain';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  AuditLog,
  ClassRepository,
  Clock,
  CurriculumGuideRepository,
  GradeCategoryRepository,
  GradeRepository,
  IdGenerator,
  StudentRepository,
  SubmissionRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { findSchoolSubscription } from '../accounts/school-subscription.ts';
import { fail, type UseCaseError } from '../errors.ts';

/** Every table a school gets back, with names in place of IDs, ready to write as files. */
export interface SchoolExport {
  readonly teachers: readonly { name: string; email: string; role: Role }[];
  readonly classes: readonly {
    name: string;
    teacher: string;
    subject: string | null;
    grade: string | null;
    section: string | null;
    schoolYear: string | null;
    archived: boolean;
  }[];
  readonly students: readonly {
    className: string;
    student: string;
    firstName: string;
    lastName: string;
    studentNumber: string | null;
    parentEmail: string | null;
    accommodations: string | null;
    familyLanguage: Language | null;
  }[];
  readonly assignments: readonly {
    className: string;
    title: string;
    category: string;
    points: number;
    dueDate: LocalDate | null;
  }[];
  readonly grades: readonly {
    className: string;
    student: string;
    assignment: string;
    status: GradeStatus;
    score: number | null;
    comment: string | null;
  }[];
  readonly attendance: readonly {
    className: string;
    student: string;
    date: LocalDate;
    status: AttendanceStatus;
    minutesLate: number | null;
    note: string | null;
  }[];
  readonly answers: readonly {
    className: string;
    student: string;
    assignment: string;
    /** The question's place in the assignment, from 1. */
    question: number;
    prompt: string;
    answer: string;
    submittedAt: Date;
    late: boolean;
  }[];
  /** The school's own curriculum guides, as the AI reads them. */
  readonly curriculum: readonly {
    subject: AssistantSubject;
    grade: GradeLevel;
    title: string;
    sourceName: string | null;
    text: string;
  }[];
}

type Tables = { -readonly [K in keyof SchoolExport]: SchoolExport[K][number][] };

export interface ExportSchoolDataDeps {
  readonly users: UserRepository;
  readonly subscriptions: SubscriptionRepository;
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly submissions: SubmissionRepository;
  readonly curriculumGuides: CurriculumGuideRepository;
  readonly auditLog: AuditLog;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

const fullName = (student: Student) => `${student.firstName} ${student.lastName}`;
const byName = (a: Student, b: Student) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/**
 * All of a school's data for its admins or account owner to keep or take elsewhere: teachers,
 * classes (archived too), students, assignments, grades, attendance, handed-in answers and the
 * school's curriculum guides. The
 * made-up sample class and teachers' private notes are left out. Each download is logged.
 */
export class ExportSchoolData {
  constructor(private readonly deps: ExportSchoolDataDeps) {}

  /** Whether to offer the download to this person. */
  async isOpenTo(actor: User): Promise<boolean> {
    const subscription = await findSchoolSubscription(this.deps.subscriptions, actor.schoolId);
    return canExportSchoolData(actor, subscription);
  }

  async execute(input: { readonly actor: User }): Promise<Result<SchoolExport, UseCaseError>> {
    const { actor } = input;
    if (!(await this.isOpenTo(actor))) return fail('forbidden');

    const users = [...(await this.deps.users.listBySchool(actor.schoolId))].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const classes = (
      await this.deps.classes.listBySchool(actor.schoolId, { includeArchived: true })
    )
      .filter((cls) => !cls.sample)
      .sort((a, b) => a.name.localeCompare(b.name));
    const tables: Tables = {
      teachers: users.map((user) => ({ name: user.name, email: user.email, role: user.role })),
      classes: [],
      students: [],
      assignments: [],
      grades: [],
      attendance: [],
      answers: [],
      curriculum: [...(await this.deps.curriculumGuides.listBySchool(actor.schoolId))]
        .sort(byCurriculumOrder)
        .map(({ subject, grade, title, sourceName, text }) => ({
          subject,
          grade,
          title,
          sourceName,
          text,
        })),
    };
    const teacherName = new Map(users.map((user) => [user.id, user.name]));
    for (const cls of classes) {
      tables.classes.push({
        name: cls.name,
        teacher: teacherName.get(cls.teacherId) ?? '',
        subject: cls.subject,
        grade: cls.grade,
        section: cls.section,
        schoolYear: cls.schoolYear,
        archived: cls.archivedAt !== null,
      });
      await this.addClass(tables, cls);
    }
    await this.deps.auditLog.record({
      id: this.deps.ids.next() as AuditEventId,
      schoolId: actor.schoolId,
      actorId: actor.id,
      action: 'school_data_exported',
      targetId: null,
      at: this.deps.clock.now(),
      review: null,
      count: null,
      classId: null,
    });
    return ok(tables);
  }

  private async addClass(tables: Tables, cls: Class): Promise<void> {
    const { schoolId } = cls;
    const className = cls.name;
    const students = [...(await this.deps.students.listByClass(schoolId, cls.id))].sort(byName);
    const nameOf = new Map(students.map((student) => [student.id, fullName(student)]));
    const order = new Map(students.map((student, i) => [student.id, i]));
    const byStudent = <T extends { studentId: Student['id'] }>(a: T, b: T) =>
      (order.get(a.studentId) ?? 0) - (order.get(b.studentId) ?? 0);
    for (const student of students) {
      tables.students.push({
        className,
        student: fullName(student),
        firstName: student.firstName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        parentEmail: student.parentEmail,
        accommodations: student.accommodations,
        familyLanguage: student.familyLanguage,
      });
    }

    const categories = await this.deps.gradeCategories.listByClass(schoolId, cls.id);
    const categoryName = new Map(categories.map((category) => [category.id, category.name]));
    const assignments = await this.deps.assignments.listByClass(schoolId, cls.id);
    const grades = await this.deps.grades.listByAssignments(
      schoolId,
      assignments.map((a) => a.id),
    );
    for (const assignment of assignments) {
      tables.assignments.push({
        className,
        title: assignment.title,
        category: categoryName.get(assignment.categoryId) ?? '',
        points: assignment.points,
        dueDate: assignment.dueDate,
      });
      for (const grade of grades.filter((g) => g.assignmentId === assignment.id).sort(byStudent)) {
        tables.grades.push({
          className,
          student: nameOf.get(grade.studentId) ?? '',
          assignment: assignment.title,
          status: grade.status,
          score: grade.score,
          comment: grade.comment,
        });
      }
      await this.addAnswers(tables, cls, assignment, nameOf, byStudent);
    }

    for (const session of await this.deps.attendanceSessions.listByClass(schoolId, cls.id)) {
      for (const record of [...session.records].sort(byStudent)) {
        tables.attendance.push({
          className,
          student: nameOf.get(record.studentId) ?? '',
          date: session.date,
          status: record.status,
          minutesLate: record.minutesLate,
          note: record.note,
        });
      }
    }
  }

  private async addAnswers(
    tables: Tables,
    cls: Class,
    assignment: Assignment,
    nameOf: ReadonlyMap<Student['id'], string>,
    byStudent: (a: { studentId: Student['id'] }, b: { studentId: Student['id'] }) => number,
  ): Promise<void> {
    const submissions = await this.deps.submissions.listByAssignment(cls.schoolId, assignment.id);
    for (const submission of [...submissions].sort(byStudent)) {
      assignment.questions.forEach((question, i) => {
        const answer = submission.answers[question.id];
        if (answer === undefined) return;
        tables.answers.push({
          className: cls.name,
          student: nameOf.get(submission.studentId) ?? '',
          assignment: assignment.title,
          question: i + 1,
          prompt: question.prompt,
          answer,
          submittedAt: submission.submittedAt,
          late: submission.late,
        });
      });
    }
  }
}
