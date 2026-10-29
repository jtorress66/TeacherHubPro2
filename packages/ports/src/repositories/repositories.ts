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
  LessonPlan,
  LocalDate,
  School,
  SchoolId,
  Semester,
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

export interface ClassRepository extends ScopedRepository<Class>, Deletable<Class> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Class[]>;
}

export interface StudentRepository extends ScopedRepository<Student>, Deletable<Student> {
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly Student[]>;
}

export interface SemesterRepository extends ScopedRepository<Semester> {
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
  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly AttendanceSession[]>;
}

export interface GameRepository extends ScopedRepository<Game>, Deletable<Game> {
  listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Game[]>;
}

export interface SubscriptionRepository extends ScopedRepository<Subscription> {
  listBySchool(schoolId: SchoolId): Promise<readonly Subscription[]>;
  /** Unscoped on purpose: billing webhooks identify a subscription by the provider's id. */
  findByExternalId(externalId: string): Promise<Subscription | null>;
}
