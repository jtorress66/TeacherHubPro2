import type {
  AssignmentId,
  AttendanceSession,
  Assignment,
  Class,
  ClassId,
  Email,
  Game,
  Grade,
  GradeCategory,
  GradeCategoryId,
  LessonPlan,
  DateRange,
  LocalDate,
  ReportCardComment,
  School,
  SchoolId,
  Semester,
  SemesterId,
  Student,
  StudentId,
  Submission,
  Subscription,
  User,
  UserId,
} from '@thp/domain';
import type { Deletable, ScopedRepository } from './scoped-repository.ts';

/** A school is its own scope. */
export interface SchoolRepository {
  findById(id: SchoolId): Promise<School | null>;
  save(school: School): Promise<void>;
}

export interface UserRepository extends ScopedRepository<User> {
  /** Unscoped on purpose: sign-in finds a user by email before the school is known. */
  findByEmail(email: Email): Promise<User | null>;
  listBySchool(schoolId: SchoolId): Promise<readonly User[]>;
}

export interface ClassListOptions {
  /** Archived classes are left out unless asked for. */
  readonly includeArchived?: boolean;
}

export interface ClassRepository extends ScopedRepository<Class>, Deletable<Class> {
  listByTeacher(
    schoolId: SchoolId,
    teacherId: UserId,
    options?: ClassListOptions,
  ): Promise<readonly Class[]>;
  listBySchool(schoolId: SchoolId, options?: ClassListOptions): Promise<readonly Class[]>;
  countBySemester(schoolId: SchoolId, semesterId: SemesterId): Promise<number>;
}

/** A student number is unique within a class; saving a duplicate is refused (it throws). */
export interface StudentRepository extends ScopedRepository<Student>, Deletable<Student> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]>;
  /** Saves all the students or none of them. */
  saveMany(students: readonly Student[]): Promise<void>;
}

export interface SemesterRepository extends ScopedRepository<Semester>, Deletable<Semester> {
  listBySchool(schoolId: SchoolId): Promise<readonly Semester[]>;
}

export interface LessonPlanRepository extends ScopedRepository<LessonPlan>, Deletable<LessonPlan> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly LessonPlan[]>;
}

export interface GradeCategoryRepository
  extends ScopedRepository<GradeCategory>, Deletable<GradeCategory> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly GradeCategory[]>;
}

export interface AssignmentRepository extends ScopedRepository<Assignment>, Deletable<Assignment> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Assignment[]>;
  countByCategory(schoolId: SchoolId, categoryId: GradeCategoryId): Promise<number>;
}

/** One grade per student and assignment: saving another replaces it. */
export interface GradeRepository extends ScopedRepository<Grade> {
  findFor(
    schoolId: SchoolId,
    studentId: StudentId,
    assignmentId: AssignmentId,
  ): Promise<Grade | null>;
  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly Grade[]>;
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Grade[]>;
  /** Every grade for the given assignments (a class's gradebook in one read). */
  listByAssignments(
    schoolId: SchoolId,
    assignmentIds: readonly AssignmentId[],
  ): Promise<readonly Grade[]>;
  deleteByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<void>;
}

export interface SubmissionRepository extends ScopedRepository<Submission> {
  listByAssignment(schoolId: SchoolId, assignmentId: AssignmentId): Promise<readonly Submission[]>;
}

export interface AttendanceSessionRepository extends ScopedRepository<AttendanceSession> {
  findByClassAndDate(
    schoolId: SchoolId,
    classId: ClassId,
    date: LocalDate,
  ): Promise<AttendanceSession | null>;
  /** Oldest first; only the dates within `range` when given. */
  listByClass(
    schoolId: SchoolId,
    classId: ClassId,
    range?: DateRange,
  ): Promise<readonly AttendanceSession[]>;
}

export interface GameRepository extends ScopedRepository<Game>, Deletable<Game> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]>;
}

export interface SubscriptionRepository extends ScopedRepository<Subscription> {
  listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]>;
  /** Unscoped on purpose: billing webhooks identify a subscription by the provider's id. */
  findByExternalId(externalId: string): Promise<Subscription | null>;
}

/** One comment per student and class: saving another replaces it. */
export interface ReportCardCommentRepository extends ScopedRepository<ReportCardComment> {
  findFor(
    schoolId: SchoolId,
    classId: ClassId,
    studentId: StudentId,
  ): Promise<ReportCardComment | null>;
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly ReportCardComment[]>;
  deleteFor(schoolId: SchoolId, classId: ClassId, studentId: StudentId): Promise<void>;
}
