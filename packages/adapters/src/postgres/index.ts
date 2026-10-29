import type { Kysely } from 'kysely';
import type {
  AssignmentRepository,
  AttendanceSessionRepository,
  ClassRepository,
  GameRepository,
  GradeCategoryRepository,
  GradeRepository,
  LessonPlanRepository,
  SchoolRepository,
  SemesterRepository,
  StudentRepository,
  SubmissionRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { PostgresAssignmentRepository } from './repositories/postgres-assignment-repository.ts';
import { PostgresAttendanceSessionRepository } from './repositories/postgres-attendance-session-repository.ts';
import { PostgresClassRepository } from './repositories/postgres-class-repository.ts';
import { PostgresGameRepository } from './repositories/postgres-game-repository.ts';
import { PostgresGradeCategoryRepository } from './repositories/postgres-grade-category-repository.ts';
import { PostgresGradeRepository } from './repositories/postgres-grade-repository.ts';
import { PostgresLessonPlanRepository } from './repositories/postgres-lesson-plan-repository.ts';
import { PostgresSchoolRepository } from './repositories/postgres-school-repository.ts';
import { PostgresSemesterRepository } from './repositories/postgres-semester-repository.ts';
import { PostgresStudentRepository } from './repositories/postgres-student-repository.ts';
import { PostgresSubmissionRepository } from './repositories/postgres-submission-repository.ts';
import { PostgresSubscriptionRepository } from './repositories/postgres-subscription-repository.ts';
import { PostgresUserRepository } from './repositories/postgres-user-repository.ts';
import type { Database } from './schema.ts';

export { createDatabase } from './database.ts';
export { migrateDown, migrateToLatest, type MigrationOutcome } from './migrate.ts';
export type { Database } from './schema.ts';

export interface PostgresRepositories {
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly semesters: SemesterRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly gradeCategories: GradeCategoryRepository;
  readonly assignments: AssignmentRepository;
  readonly grades: GradeRepository;
  readonly submissions: SubmissionRepository;
  readonly attendanceSessions: AttendanceSessionRepository;
  readonly games: GameRepository;
  readonly subscriptions: SubscriptionRepository;
}

/** Every repository on one connection pool; wired in each app's composition root. */
export function createPostgresRepositories(db: Kysely<Database>): PostgresRepositories {
  return {
    schools: new PostgresSchoolRepository(db),
    users: new PostgresUserRepository(db),
    classes: new PostgresClassRepository(db),
    students: new PostgresStudentRepository(db),
    semesters: new PostgresSemesterRepository(db),
    lessonPlans: new PostgresLessonPlanRepository(db),
    gradeCategories: new PostgresGradeCategoryRepository(db),
    assignments: new PostgresAssignmentRepository(db),
    grades: new PostgresGradeRepository(db),
    submissions: new PostgresSubmissionRepository(db),
    attendanceSessions: new PostgresAttendanceSessionRepository(db),
    games: new PostgresGameRepository(db),
    subscriptions: new PostgresSubscriptionRepository(db),
  };
}
